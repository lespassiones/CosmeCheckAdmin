/**
 * Server-only queries for the "Coûts IA & Cache" page (/ai).
 *
 * Everything here is SERVER-ONLY and runs with supabaseAdmin (service_role),
 * so we bypass RLS and read across all users without auth context.
 *
 * The token-cost calibration (gpt-4o-mini-ish $/M tokens) matches what is
 * used on the Vue d'ensemble page — keep both in sync if pricing changes.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { DailySeriesPoint } from "@/lib/queries/overview";

/**
 * Tarifs par modèle ($/1M tokens) + frais de recherche web PAR APPEL.
 *
 * Point clé : les modèles `*-search-preview` facturent un frais de recherche web
 * FIXE par appel (≈ $27,5 / 1000 appels en contexte "medium"), EN PLUS des
 * tokens. C'est ce frais, longtemps invisible (appels non loggés), qui faisait
 * sous-estimer le coût d'un facteur ~15. On l'ajoute désormais par ligne.
 */
type PriceRow = { in: number; out: number; webFeePerCall?: number };

const PRICING: Record<string, PriceRow> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o-mini-search-preview": { in: 0.15, out: 0.6, webFeePerCall: 0.0275 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-search-preview": { in: 2.5, out: 10, webFeePerCall: 0.035 },
  "mistral-small-latest": { in: 0.2, out: 0.6 },
};
const DEFAULT_PRICE: PriceRow = PRICING["gpt-4o-mini"];

/** Modèle effectif d'une ligne : la colonne `model` si présente, sinon déduit. */
function resolveModel(
  model: string | null | undefined,
  provider: string | null | undefined,
): string | null {
  if (model) return model;
  if (provider === "mistral") return "mistral-small-latest";
  if (provider === "tesseract" || provider === "cache") return null; // gratuit
  return "gpt-4o-mini"; // openai par défaut (anciennes lignes sans model)
}

export type CostRow = {
  model?: string | null;
  provider?: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
};

/** Coût $ d'UNE ligne ai_logs (tokens au tarif du modèle + frais web par appel). */
export function rowCost(row: CostRow): number {
  const m = resolveModel(row.model, row.provider);
  if (m === null) return 0;
  const p = PRICING[m] ?? DEFAULT_PRICE;
  return (
    ((row.tokens_in ?? 0) / 1_000_000) * p.in
    + ((row.tokens_out ?? 0) / 1_000_000) * p.out
    + (p.webFeePerCall ?? 0)
  );
}

/** Pick the value at `p`-th percentile (0..1) from an already-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

/**
 * PIÈGE PostgREST : toute lecture est plafonnée à 1000 lignes par page.
 * `ai_logs` et `ai_cache` dépassent ce seuil → sans pagination, les sommes
 * (hits, coûts estimés, breakdowns) étaient calculées sur un SOUS-ENSEMBLE
 * silencieusement tronqué (ex. hit rate affiché 0,5 % au lieu de ~5 %).
 * Ce helper boucle par pages de 1000 jusqu'à épuisement (garde-fou 50 pages).
 */
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let i = 0; i < 50; i++) {
    const { data } = await build(i * PAGE, i * PAGE + PAGE - 1);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   1. KPIs : cost today / 7d / 30d + cache hit rate
   ──────────────────────────────────────────────────────────────────────────── */

export type AiKpis = {
  costTodayUSD: number;
  cost7dUSD: number;
  cost30dUSD: number;
  /** Cache efficiency: total ai_cache.hits / total ai_logs calls over all time. */
  cacheHitRate: number;
};

export async function fetchAiKpis(): Promise<AiKpis> {
  const sb = supabaseAdmin();
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const start7d = new Date(startOfToday.getTime() - 6 * 86_400_000);
  const start30d = new Date(startOfToday.getTime() - 29 * 86_400_000);

  // Une seule lecture PAGINÉE des 30 derniers jours (couvre aussi today/7j) +
  // les compteurs de hits du cache serveur. Voir fetchAllRows (piège 1000 lignes).
  type LogRow = CostRow & { created_at: string };
  const [logs30, cacheHits, totalCallsRes] = await Promise.all([
    fetchAllRows<LogRow>((from, to) =>
      sb
        .schema("cosme_check")
        .from("ai_logs")
        .select("created_at, model, provider, tokens_in, tokens_out")
        .gte("created_at", start30d.toISOString())
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ hits: number | null }>((from, to) =>
      sb.schema("cosme_check").from("ai_cache").select("hits").order("key").range(from, to),
    ),
    sb.schema("cosme_check").from("ai_logs").select("id", { count: "exact", head: true }),
  ]);

  const sumCost = (rows: LogRow[]): number => rows.reduce((s, r) => s + rowCost(r), 0);
  const todayIso = startOfToday.toISOString();
  const sevenIso = start7d.toISOString();

  const totalHits = cacheHits.reduce((s, r) => s + (r.hits ?? 0), 0);
  const totalCalls = totalCallsRes.count ?? 0;
  // Hit rate = hits / (hits + calls). Avoids producing > 100% if cache served
  // more than the logged calls, and gracefully handles the empty case.
  const denom = totalHits + totalCalls;
  const cacheHitRate = denom === 0 ? 0 : totalHits / denom;

  return {
    costTodayUSD: sumCost(logs30.filter((r) => r.created_at >= todayIso)),
    cost7dUSD: sumCost(logs30.filter((r) => r.created_at >= sevenIso)),
    cost30dUSD: sumCost(logs30),
    cacheHitRate,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Daily cost series (30 days) — shape compatible with DailyTrendChart
   ──────────────────────────────────────────────────────────────────────────── */

export async function fetchAiDailyCostSeries(days = 30): Promise<DailySeriesPoint[]> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const data = await fetchAllRows<CostRow & { created_at: string }>((from, to) =>
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("created_at, model, provider, tokens_in, tokens_out")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  const buckets = new Map<string, DailySeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, analyses: 0, signups: 0, cost_usd: 0 });
  }

  for (const l of data) {
    const key = l.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.cost_usd += rowCost(l);
  }

  return Array.from(buckets.values());
}

/* ────────────────────────────────────────────────────────────────────────────
   3. Breakdown by feature — calls, tokens, p50/p95 latency, cost
   ──────────────────────────────────────────────────────────────────────────── */

export type AiFeatureBreakdown = {
  feature: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  cost_usd: number;
};

export type AiProviderBreakdown = {
  provider: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
};

export type AiBreakdowns = {
  byFeature: AiFeatureBreakdown[];
  byProvider: AiProviderBreakdown[];
};

/**
 * Pulls the last 30 days of ai_logs once and buckets by feature + provider.
 * Latency percentiles are computed in JS — at our volumes (< 50k rows / month)
 * this is cheaper than a window function and easier to reason about.
 */
export async function fetchAiBreakdowns(days = 30): Promise<AiBreakdowns> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await fetchAllRows<{
    feature: string | null;
    provider: string | null;
    model: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
    duration_ms: number | null;
  }>((from, to) =>
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("feature, provider, model, tokens_in, tokens_out, duration_ms, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  type FeatureAgg = {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
    durations: number[];
  };
  type ProviderAgg = {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
  };

  const featureMap = new Map<string, FeatureAgg>();
  const providerMap = new Map<string, ProviderAgg>();

  for (const r of rows) {
    const feature = r.feature ?? "unknown";
    const provider = r.provider ?? "unknown";
    const tIn = r.tokens_in ?? 0;
    const tOut = r.tokens_out ?? 0;
    const c = rowCost(r);

    const f = featureMap.get(feature) ?? {
      calls: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost: 0,
      durations: [],
    };
    f.calls += 1;
    f.tokens_in += tIn;
    f.tokens_out += tOut;
    f.cost += c;
    if (r.duration_ms !== null && r.duration_ms !== undefined) {
      f.durations.push(r.duration_ms);
    }
    featureMap.set(feature, f);

    const p = providerMap.get(provider) ?? {
      calls: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost: 0,
    };
    p.calls += 1;
    p.tokens_in += tIn;
    p.tokens_out += tOut;
    p.cost += c;
    providerMap.set(provider, p);
  }

  const byFeature: AiFeatureBreakdown[] = Array.from(featureMap.entries())
    .map(([feature, agg]) => {
      const sorted = [...agg.durations].sort((a, b) => a - b);
      return {
        feature,
        calls: agg.calls,
        tokens_in: agg.tokens_in,
        tokens_out: agg.tokens_out,
        latency_p50_ms: percentile(sorted, 0.5),
        latency_p95_ms: percentile(sorted, 0.95),
        cost_usd: agg.cost,
      };
    })
    .sort((a, b) => b.cost_usd - a.cost_usd);

  const byProvider: AiProviderBreakdown[] = Array.from(providerMap.entries())
    .map(([provider, agg]) => ({
      provider,
      calls: agg.calls,
      tokens_in: agg.tokens_in,
      tokens_out: agg.tokens_out,
      cost_usd: agg.cost,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  return { byFeature, byProvider };
}

/* ────────────────────────────────────────────────────────────────────────────
   4. ai_cache (LLM result cache)
   ──────────────────────────────────────────────────────────────────────────── */

export type AiCacheStats = {
  totalEntries: number;
  totalHits: number;
  /** hits / (hits + ai_logs.calls) — same definition as in AiKpis. */
  hitRate: number;
  topEntries: Array<{ cache_key: string; hits: number; created_at: string }>;
};

export async function fetchAiCacheStats(): Promise<AiCacheStats> {
  const sb = supabaseAdmin();

  const [countRes, hitsRes, topRes, totalCallsRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("ai_cache")
      .select("cache_key", { count: "exact", head: true }),
    sb.schema("cosme_check").from("ai_cache").select("hits"),
    sb
      .schema("cosme_check")
      .from("ai_cache")
      .select("cache_key, hits, created_at")
      .order("hits", { ascending: false })
      .limit(20),
    sb.schema("cosme_check").from("ai_logs").select("id", { count: "exact", head: true }),
  ]);

  const totalHits = ((hitsRes.data ?? []) as { hits: number | null }[])
    .reduce((s, r) => s + (r.hits ?? 0), 0);
  const totalCalls = totalCallsRes.count ?? 0;
  const denom = totalHits + totalCalls;
  const hitRate = denom === 0 ? 0 : totalHits / denom;

  return {
    totalEntries: countRes.count ?? 0,
    totalHits,
    hitRate,
    topEntries: ((topRes.data ?? []) as {
      cache_key: string;
      hits: number | null;
      created_at: string;
    }[]).map((r) => ({
      cache_key: r.cache_key,
      hits: r.hits ?? 0,
      created_at: r.created_at,
    })),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   5. product_inci_cache (web-search cache)
   ──────────────────────────────────────────────────────────────────────────── */

export type ProductInciCacheStats = {
  totalEntries: number;
  bySource: Array<{ source: string; count: number }>;
};

export async function fetchProductInciCacheStats(): Promise<ProductInciCacheStats> {
  const sb = supabaseAdmin();

  const [countRes, sourcesRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("product_inci_cache")
      .select("id", { count: "exact", head: true }),
    // Pulling the `source` column once and bucketing in JS keeps this query
    // schema-agnostic (no need for an RPC) and the table size is bounded.
    sb.schema("cosme_check").from("product_inci_cache").select("source"),
  ]);

  const bucket = new Map<string, number>();
  for (const r of (sourcesRes.data ?? []) as { source: string | null }[]) {
    const src = r.source ?? "unknown";
    bucket.set(src, (bucket.get(src) ?? 0) + 1);
  }
  const bySource = Array.from(bucket.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEntries: countRes.count ?? 0,
    bySource,
  };
}
