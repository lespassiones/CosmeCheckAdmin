/**
 * Aggregate read helpers for the "Vue d'ensemble" landing page.
 *
 * Everything here is SERVER-ONLY and runs with supabaseAdmin (service_role),
 * so we bypass RLS and read across all users without auth context.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { rowCost } from "@/lib/queries/ai";

export type OverviewKpis = {
  totalUsers: number;
  newSignups7d: number;
  dau: number;
  analysesToday: number;
  creditsUsedToday: number;
  totalAnalyses: number;
  totalProducts: number;
  recentErrors24h: number;
};

export async function fetchOverviewKpis(): Promise<OverviewKpis> {
  const sb = supabaseAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);
  const oneDayAgo = new Date(today.getTime() - 86_400_000);

  // All count queries fire in parallel — Postgres handles them with ease at
  // our current data sizes (< 100 k rows on the busiest tables).
  const [
    totalUsersRes,
    newSignupsRes,
    dauRes,
    analysesTodayRes,
    creditsTodayRes,
    totalAnalysesRes,
    totalProductsRes,
    errors24hRes,
  ] = await Promise.all([
    // Count auth users via the listUsers admin API would be slow; the
    // cosme_check.user_profiles table mirrors auth.users 1-to-1 via trigger.
    sb.schema("cosme_check").from("user_profiles").select("id", { count: "exact", head: true }),
    // New signups in the last 7 days (use auth.users via admin API count)
    sb.auth.admin.listUsers({ page: 1, perPage: 1 }).then((r) => {
      if (r.error) return { count: 0 };
      // Filter client-side because admin API doesn't expose date filters.
      // For a single-admin install this is bounded and fine.
      return { count: r.data.users.filter((u) => new Date(u.created_at) >= sevenDaysAgo).length };
    }),
    // DAU = distinct user_ids in ai_logs today
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("user_id")
      .gte("created_at", today.toISOString())
      .not("user_id", "is", null),
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    sb
      .schema("cosme_check")
      .from("user_credits")
      .select("used")
      .eq("day", today.toISOString().slice(0, 10)),
    sb.schema("cosme_check").from("analyses").select("id", { count: "exact", head: true }),
    sb.schema("cosme_check").from("products").select("id", { count: "exact", head: true }),
    sb
      .schema("cosme_check")
      .from("error_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneDayAgo.toISOString()),
  ]);

  const dauSet = new Set<string>();
  for (const row of (dauRes.data ?? []) as { user_id: string | null }[]) {
    if (row.user_id) dauSet.add(row.user_id);
  }
  const creditsUsedToday = (creditsTodayRes.data ?? [])
    .map((r) => (r as { used?: number | null }).used ?? 0)
    .reduce((s, n) => s + n, 0);

  return {
    totalUsers: totalUsersRes.count ?? 0,
    newSignups7d: newSignupsRes.count ?? 0,
    dau: dauSet.size,
    analysesToday: analysesTodayRes.count ?? 0,
    creditsUsedToday,
    totalAnalyses: totalAnalysesRes.count ?? 0,
    totalProducts: totalProductsRes.count ?? 0,
    recentErrors24h: errors24hRes.count ?? 0,
  };
}

/** AI tokens + estimated cost for the last 24 h, broken down by feature. */
export type AiTodayBreakdown = {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCallsToday: number;
  estimatedCostUSD: number;
  byFeature: Array<{ feature: string; calls: number; tokens_in: number; tokens_out: number; estimated_cost_usd: number }>;
};

export async function fetchAiToday(): Promise<AiTodayBreakdown> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await sb
    .schema("cosme_check")
    .from("ai_logs")
    .select("feature, model, provider, tokens_in, tokens_out")
    .gte("created_at", since.toISOString());

  const rows = (data ?? []) as {
    feature: string | null;
    model: string | null;
    provider: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
  }[];

  const map = new Map<string, { calls: number; tokens_in: number; tokens_out: number; cost: number }>();
  let totalIn = 0;
  let totalOut = 0;
  let estimatedCostUSD = 0;
  for (const r of rows) {
    const feature = r.feature ?? "unknown";
    const c = rowCost(r);
    const cur = map.get(feature) ?? { calls: 0, tokens_in: 0, tokens_out: 0, cost: 0 };
    cur.calls += 1;
    cur.tokens_in += r.tokens_in ?? 0;
    cur.tokens_out += r.tokens_out ?? 0;
    cur.cost += c;
    map.set(feature, cur);
    totalIn += r.tokens_in ?? 0;
    totalOut += r.tokens_out ?? 0;
    estimatedCostUSD += c;
  }

  const byFeature = Array.from(map.entries())
    .map(([feature, agg]) => ({
      feature,
      calls: agg.calls,
      tokens_in: agg.tokens_in,
      tokens_out: agg.tokens_out,
      estimated_cost_usd: agg.cost,
    }))
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd);

  return {
    totalTokensIn: totalIn,
    totalTokensOut: totalOut,
    totalCallsToday: rows.length,
    estimatedCostUSD,
    byFeature,
  };
}

/** Time-series for the dashboard charts. Last `days` days, one row per day. */
export type DailySeriesPoint = { day: string; analyses: number; signups: number; cost_usd: number };

export async function fetchDailySeries(days = 30): Promise<DailySeriesPoint[]> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  // Pull everything once, then bucket client-side. The volumes involved here
  // (a few thousand rows max) make this perfectly fine without an MV.
  const [analysesRes, logsRes, usersRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("created_at")
      .gte("created_at", since.toISOString()),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("created_at, model, provider, tokens_in, tokens_out")
      .gte("created_at", since.toISOString()),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const buckets = new Map<string, DailySeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, analyses: 0, signups: 0, cost_usd: 0 });
  }

  for (const a of (analysesRes.data ?? []) as { created_at: string }[]) {
    const key = a.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.analyses += 1;
  }
  for (const l of (logsRes.data ?? []) as {
    created_at: string;
    model: string | null;
    provider: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
  }[]) {
    const key = l.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.cost_usd += rowCost(l);
  }
  if (!usersRes.error && usersRes.data) {
    for (const u of usersRes.data.users) {
      const key = u.created_at.slice(0, 10);
      const b = buckets.get(key);
      if (b) b.signups += 1;
    }
  }

  return Array.from(buckets.values());
}
