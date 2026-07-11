/**
 * Abonnements — source de vérité HYBRIDE :
 *   - la LISTE des abonnés vient de NOTRE base (user_profiles.tier='premium',
 *     tenue à jour en temps réel par l'edge revenucat-webhook) ;
 *   - le DÉTAIL (plan mensuel/annuel, essai, échéance, store, sandbox) vient de
 *     l'API RevenueCat v1 `GET /subscribers/{app_user_id}` (la seule qui marche
 *     avec notre clé legacy : `/v1/customers` n'existe pas, la v2 exige une
 *     nouvelle clé). Un abonné = 1 appel ; volumes minuscules, aucun souci.
 *
 * Dégradation douce : clé absente ou API en erreur → la liste s'affiche quand
 * même (détail "—"), jamais d'écran d'erreur.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const RC_URL = "https://api.revenuecat.com/v1/subscribers";

export type PremiumSubscriber = {
  userId: string;
  email: string | null;
  firstName: string | null;
  since: string | null; // date de passage premium (updated_at profil, indicatif)
  /** Détail RevenueCat (null si clé absente / API en erreur / introuvable). */
  rc: {
    product: string | null; // ex. premium_yearly
    plan: "annuel" | "mensuel" | null;
    isTrial: boolean;
    expiresAt: string | null;
    store: string | null; // play_store / app_store / stripe...
    isSandbox: boolean;
  } | null;
};

export type BillingOverview = {
  premiumCount: number;
  trialCount: number;
  rcConfigured: boolean;
  subscribers: PremiumSubscriber[];
};

type RcSubscription = {
  expires_date?: string | null;
  period_type?: string | null;
  is_sandbox?: boolean;
  store?: string | null;
  product_plan_identifier?: string | null;
};

async function fetchRcDetail(
  userId: string,
  key: string,
): Promise<PremiumSubscriber["rc"]> {
  try {
    const r = await fetch(`${RC_URL}/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      subscriber?: {
        entitlements?: Record<string, { product_identifier?: string }>;
        subscriptions?: Record<string, RcSubscription>;
      };
    };
    const subs = j.subscriber?.subscriptions ?? {};
    // Prend l'abonnement le plus récent (par expires_date desc).
    const entries = Object.entries(subs).sort((a, b) =>
      String(b[1].expires_date ?? "").localeCompare(String(a[1].expires_date ?? "")),
    );
    if (entries.length === 0) return null;
    const [product, sub] = entries[0];
    const planId = (sub.product_plan_identifier ?? product).toLowerCase();
    return {
      product,
      plan: planId.includes("year") || planId.includes("annual")
        ? "annuel"
        : planId.includes("month")
          ? "mensuel"
          : null,
      isTrial: sub.period_type === "trial",
      expiresAt: sub.expires_date ?? null,
      store: sub.store ?? null,
      isSandbox: Boolean(sub.is_sandbox),
    };
  } catch {
    return null;
  }
}

export async function fetchBillingOverview(): Promise<BillingOverview> {
  const sb = supabaseAdmin();
  const key = process.env.REVENUCAT_SECRET_API_KEY ?? "";

  const { data: premiumRows } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .select("id, first_name, updated_at")
    .eq("tier", "premium")
    .order("updated_at", { ascending: false })
    .limit(200);

  const rows = (premiumRows ?? []) as { id: string; first_name: string | null; updated_at: string | null }[];

  // Emails via l'API admin auth (1 page suffit largement à cette échelle).
  const emails = new Map<string, string>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) emails.set(u.id, u.email ?? "");
  } catch {
    // best-effort
  }

  const subscribers: PremiumSubscriber[] = await Promise.all(
    rows.map(async (r) => ({
      userId: r.id,
      email: emails.get(r.id) ?? null,
      firstName: r.first_name,
      since: r.updated_at,
      rc: key ? await fetchRcDetail(r.id, key) : null,
    })),
  );

  return {
    premiumCount: rows.length,
    trialCount: subscribers.filter((s) => s.rc?.isTrial).length,
    rcConfigured: Boolean(key),
    subscribers,
  };
}
