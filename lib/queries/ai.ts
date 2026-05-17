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

// Rough $/1M tokens — calibrated for gpt-4o-mini + mistral-small.
// Used as a ROUGH estimator, not a billing source. Kept identical to
// lib/queries/overview.ts.
const COST_PER_M_IN_USD = 0.15;
const COST_PER_M_OUT_USD = 0.6;

/** Convert raw token counts into a $ estimate. */
function tokensToCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * COST_PER_M_IN_USD
    + (tokensOut / 1_000_000) * COST_PER_M_OUT_USD
  );
}

/** Pick the value at `p`-th percentile (0..1) from an already-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
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

  const [todayRes, sevenRes, thirtyRes, cacheHitsRes, totalCallsRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("tokens_in, tokens_out")
      .gte("created_at", startOfToday.toISOString()),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("tokens_in, tokens_out")
      .gte("created_at", start7d.toISOString()),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("tokens_in, tokens_out")
      .gte("created_at", start30d.toISOString()),
    sb.schema("cosme_check").from("ai_cache").select("hits"),
    sb.schema("cosme_check").from("ai_logs").select("id", { count: "exact", head: true }),
  ]);

  const sumCost = (
    rows: { tokens_in: number | null; tokens_out: number | null }[] | null,
  ): number =>
    (rows ?? []).reduce(
      (s, r) => s + tokensToCost(r.tokens_in ?? 0, r.tokens_out ?? 0),
      0,
    );

  const totalHits = ((cacheHitsRes.data ?? []) as { hits: number | null }[])
    .reduce((s, r) => s + (r.hits ?? 0), 0);
  const totalCalls = totalCallsRes.count ?? 0;
  // Hit rate = hits / (hits + calls). Avoids producing > 100% if cache served
  // more than the logged calls, and gracefully handles the empty case.
  const denom = totalHits + totalCalls;
  const cacheHitRate = denom === 0 ? 0 : totalHits / denom;

  return {
    costTodayUSD: sumCost(todayRes.data as { tokens_in: number | null; tokens_out: number | null }[] | null),
    cost7dUSD: sumCost(sevenRes.data as { tokens_in: number | null; tokens_out: number | null }[] | null),
    cost30dUSD: sumCost(thirtyRes.data as { tokens_in: number | null; tokens_out: number | null }[] | null),
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

  const { data } = await sb
    .schema("cosme_check")
    .from("ai_logs")
    .select("created_at, tokens_in, tokens_out")
    .gte("created_at", since.toISOString());

  const buckets = new Map<string, DailySeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, analyses: 0, signups: 0, cost_usd: 0 });
  }

  for (const l of (data ?? []) as {
    created_at: string;
    tokens_in: number | null;
    tokens_out: number | null;
  }[]) {
    const key = l.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.cost_usd += tokensToCost(l.tokens_in ?? 0, l.tokens_out ?? 0);
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

  const { data } = await sb
    .schema("cosme_check")
    .from("ai_logs")
    .select("feature, provider, tokens_in, tokens_out, duration_ms")
    .gte("created_at", since.toISOString());

  const rows = (data ?? []) as {
    feature: string | null;
    provider: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
    duration_ms: number | null;
  }[];

  type FeatureAgg = {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    durations: number[];
  };
  type ProviderAgg = {
    calls: number;
    tokens_in: number;
    tokens_out: number;
  };

  const featureMap = new Map<string, FeatureAgg>();
  const providerMap = new Map<string, ProviderAgg>();

  for (const r of rows) {
    const feature = r.feature ?? "unknown";
    const provider = r.provider ?? "unknown";
    const tIn = r.tokens_in ?? 0;
    const tOut = r.tokens_out ?? 0;

    const f = featureMap.get(feature) ?? {
      calls: 0,
      tokens_in: 0,
      tokens_out: 0,
      durations: [],
    };
    f.calls += 1;
    f.tokens_in += tIn;
    f.tokens_out += tOut;
    if (r.duration_ms !== null && r.duration_ms !== undefined) {
      f.durations.push(r.duration_ms);
    }
    featureMap.set(feature, f);

    const p = providerMap.get(provider) ?? {
      calls: 0,
      tokens_in: 0,
      tokens_out: 0,
    };
    p.calls += 1;
    p.tokens_in += tIn;
    p.tokens_out += tOut;
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
        cost_usd: tokensToCost(agg.tokens_in, agg.tokens_out),
      };
    })
    .sort((a, b) => b.cost_usd - a.cost_usd);

  const byProvider: AiProviderBreakdown[] = Array.from(providerMap.entries())
    .map(([provider, agg]) => ({
      provider,
      calls: agg.calls,
      tokens_in: agg.tokens_in,
      tokens_out: agg.tokens_out,
      cost_usd: tokensToCost(agg.tokens_in, agg.tokens_out),
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
