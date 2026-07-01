/**
 * Synchronisation des coûts OpenAI RÉELS (= la facture OpenAI, en USD) via
 * l'API Organization Costs : GET https://api.openai.com/v1/organization/costs
 *
 * Pourquoi : `ai_logs` ne peut pas reconstruire le vrai coût (model + tokens
 * manquants sur la majorité des lignes, frais web-search non loggés). L'API
 * Costs renvoie le montant EXACT facturé par jour → source de vérité, passé
 * comme présent, sans dépendre de notre logging.
 *
 * Nécessite une CLÉ ADMIN OpenAI (`sk-admin-…`) dans `OPENAI_ADMIN_KEY`
 * (les clés projet `sk-proj-…` n'ont PAS accès aux endpoints organization/*).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const COSTS_URL = "https://api.openai.com/v1/organization/costs";

export function hasOpenAiAdminKey(): boolean {
  return Boolean(process.env.OPENAI_ADMIN_KEY);
}

type CostBucket = {
  start_time?: number;
  // NB: l'API OpenAI renvoie `amount.value` en STRING (ex "0.0605") → Number().
  results?: { amount?: { value?: number | string; currency?: string } }[];
};
type CostsPage = { data?: CostBucket[]; has_more?: boolean; next_page?: string | null };

export type SyncResult = { ok: boolean; days: number; error?: string };

/** Jour UTC 'YYYY-MM-DD' d'un timestamp unix (secondes). */
function utcDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Récupère les coûts quotidiens depuis OpenAI et les upsert dans
 * cosme_check.openai_cost_daily. `days` = profondeur d'historique (défaut 180).
 */
export async function syncOpenAiCosts(opts?: { days?: number }): Promise<SyncResult> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return { ok: false, days: 0, error: "OPENAI_ADMIN_KEY manquant (clé admin sk-admin-…)." };

  const days = opts?.days ?? 180;
  const startTime = Math.floor(Date.now() / 1000) - days * 86400;
  const perDay = new Map<string, number>();

  let page: string | undefined;
  try {
    // Pagination bornée (garde-fou anti-boucle).
    for (let i = 0; i < 30; i++) {
      const url = new URL(COSTS_URL);
      url.searchParams.set("start_time", String(startTime));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", "180");
      if (page) url.searchParams.set("page", page);

      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!r.ok) {
        const body = (await r.text()).slice(0, 200);
        return { ok: false, days: 0, error: `OpenAI ${r.status}: ${body}` };
      }
      const j = (await r.json()) as CostsPage;
      for (const bucket of j.data ?? []) {
        if (!bucket.start_time) continue;
        const day = utcDay(bucket.start_time);
        const usd = (bucket.results ?? []).reduce((s, res) => s + Number(res?.amount?.value ?? 0), 0);
        perDay.set(day, (perDay.get(day) ?? 0) + usd);
      }
      if (!j.has_more || !j.next_page) break;
      page = j.next_page;
    }
  } catch (e) {
    return { ok: false, days: 0, error: (e as Error).message };
  }

  const rows = Array.from(perDay.entries()).map(([day, amount]) => ({
    day,
    amount_usd: Number(amount.toFixed(4)),
    source: "openai_costs_api",
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabaseAdmin()
      .schema("cosme_check")
      .from("openai_cost_daily")
      .upsert(rows, { onConflict: "day" });
    if (error) return { ok: false, days: 0, error: error.message };
  }

  return { ok: true, days: rows.length };
}

/**
 * Synchronise SI nécessaire : jamais synchronisé, ou dernière synchro > `maxAgeH`
 * heures. Rend la page autonome (se met à jour toute seule à la visite). No-op
 * silencieux si pas de clé admin.
 */
export async function ensureFreshCosts(maxAgeH = 12): Promise<void> {
  if (!hasOpenAiAdminKey()) return;
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .schema("cosme_check")
      .from("openai_cost_daily")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    const last = (data?.[0] as { updated_at?: string } | undefined)?.updated_at;
    const stale = !last || Date.now() - new Date(last).getTime() > maxAgeH * 3600_000;
    if (stale) await syncOpenAiCosts();
  } catch {
    // non-bloquant : on affiche les données existantes
  }
}

export type RealAiCost = {
  hasData: boolean;
  today: number;
  last7: number;
  last30: number;
  series: { date: string; cost: number }[];
  lastSync: string | null;
};

/** Lit les coûts réels (30 derniers jours) depuis openai_cost_daily. */
export async function fetchRealAiCost(): Promise<RealAiCost> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceDay = since.toISOString().slice(0, 10);
  const todayDay = new Date().toISOString().slice(0, 10);
  const day7 = new Date();
  day7.setDate(day7.getDate() - 6);
  const day7Str = day7.toISOString().slice(0, 10);

  const { data } = await sb
    .schema("cosme_check")
    .from("openai_cost_daily")
    .select("day, amount_usd, updated_at")
    .gte("day", sinceDay)
    .order("day", { ascending: true });

  const rows = (data ?? []) as { day: string; amount_usd: number; updated_at: string }[];
  const byDay = new Map(rows.map((r) => [r.day, Number(r.amount_usd)]));

  // Série continue sur 30 jours (jours sans coût = 0).
  const series: { date: string; cost: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, cost: byDay.get(key) ?? 0 });
  }

  const last30 = rows.reduce((s, r) => s + Number(r.amount_usd), 0);
  const last7 = rows.filter((r) => r.day >= day7Str).reduce((s, r) => s + Number(r.amount_usd), 0);
  const today = byDay.get(todayDay) ?? 0;
  const lastSync = rows.reduce<string | null>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null);

  return { hasData: rows.length > 0, today, last7, last30, series, lastSync };
}
