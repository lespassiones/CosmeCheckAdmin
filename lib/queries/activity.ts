/**
 * Cross-user activity feed for the "Activité" page.
 *
 * All reads run server-side via supabaseAdmin() so we bypass RLS and see every
 * row in the cosme_check schema. Aggregations are kept in-memory (Map-based
 * bucketing) because the volumes involved here are bounded — a few thousand
 * rows over 30 days at our current scale.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// ─── KPI cards ────────────────────────────────────────────────────────────

export type ActivityKpis = {
  analysesToday: number;
  ocrScansToday: number;
  coherenceToday: number;
  advisorMessagesToday: number;
};

export async function fetchActivityKpis(): Promise<ActivityKpis> {
  const sb = supabaseAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sinceIso = today.toISOString();

  const [analysesRes, ocrRes, coherenceRes, advisorRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("feature", "ocr")
      .gte("created_at", sinceIso),
    sb
      .schema("cosme_check")
      .from("coherence_analyses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("feature", "synthesis")
      .gte("created_at", sinceIso),
  ]);

  return {
    analysesToday: analysesRes.count ?? 0,
    ocrScansToday: ocrRes.count ?? 0,
    coherenceToday: coherenceRes.count ?? 0,
    advisorMessagesToday: advisorRes.count ?? 0,
  };
}

// ─── Daily trend (analyses + ocr) ─────────────────────────────────────────

export type ActivityTrendPoint = {
  day: string;
  analyses: number;
  ocr: number;
};

export async function fetchActivityTrend(days = 30): Promise<ActivityTrendPoint[]> {
  const sb = supabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceIso = since.toISOString();

  const [analysesRes, ocrRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("created_at")
      .gte("created_at", sinceIso),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("created_at")
      .eq("feature", "ocr")
      .gte("created_at", sinceIso),
  ]);

  const buckets = new Map<string, ActivityTrendPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, analyses: 0, ocr: 0 });
  }

  for (const a of (analysesRes.data ?? []) as { created_at: string }[]) {
    const key = a.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.analyses += 1;
  }
  for (const l of (ocrRes.data ?? []) as { created_at: string }[]) {
    const key = l.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) b.ocr += 1;
  }

  return Array.from(buckets.values());
}

// ─── Recent analyses table ────────────────────────────────────────────────

export type RecentAnalysisRow = {
  id: string;
  user_id: string | null;
  user_email: string;
  product_label: string | null;
  score: number | null;
  category: string | null;
  created_at: string;
};

export async function fetchRecentAnalyses(limit = 30): Promise<RecentAnalysisRow[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .schema("cosme_check")
    .from("analyses")
    .select("id, user_id, product_label, score, category, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    user_id: string | null;
    product_label: string | null;
    score: number | null;
    category: string | null;
    created_at: string;
  }>;

  // Resolve user emails in one shot via the admin API. listUsers paginates;
  // for our current scale (a single page covers everyone), one call is plenty.
  const { data: authPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map<string, string>();
  if (authPage) {
    for (const u of authPage.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_email: r.user_id ? emailById.get(r.user_id) ?? "—" : "—",
    product_label: r.product_label,
    score: r.score,
    category: r.category,
    created_at: r.created_at,
  }));
}

// ─── Top distributions (brand / product / category) ───────────────────────

export type TopRow = { key: string; count: number };

export type ActivityDistributions = {
  topBrands: TopRow[];
  topProducts: TopRow[];
  byCategory: TopRow[];
};

export async function fetchActivityDistributions(): Promise<ActivityDistributions> {
  const sb = supabaseAdmin();

  // Pull just the dimensions we need. At current volumes (< 100 k rows) a
  // single full-table read is faster than 3 GROUP BY round-trips.
  const { data } = await sb
    .schema("cosme_check")
    .from("analyses")
    .select("brand, product_label, category");

  const rows = (data ?? []) as Array<{
    brand: string | null;
    product_label: string | null;
    category: string | null;
  }>;

  const brandCount = new Map<string, number>();
  const productCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  for (const r of rows) {
    if (r.brand && r.brand.trim().length > 0) {
      const k = r.brand.trim();
      brandCount.set(k, (brandCount.get(k) ?? 0) + 1);
    }
    if (r.product_label && r.product_label.trim().length > 0) {
      const k = r.product_label.trim();
      productCount.set(k, (productCount.get(k) ?? 0) + 1);
    }
    const cat = r.category && r.category.trim().length > 0 ? r.category.trim() : "non classé";
    categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }

  const toSortedTop = (m: Map<string, number>, top: number): TopRow[] =>
    Array.from(m.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top);

  return {
    topBrands: toSortedTop(brandCount, 10),
    topProducts: toSortedTop(productCount, 10),
    byCategory: toSortedTop(categoryCount, 12),
  };
}

// ─── Coherence verdict breakdown (today) ──────────────────────────────────

export type CoherenceVerdict = "tenu" | "partiel" | "non_tenu" | "hors_sujet";

export type CoherenceVerdictBreakdown = {
  total: number;
  counts: Record<CoherenceVerdict, number>;
};

type CoherencePromise = { verdict?: string | null };
type CoherenceResultJson = { promises?: CoherencePromise[] | null } | null;

export async function fetchCoherenceVerdictsToday(): Promise<CoherenceVerdictBreakdown> {
  const sb = supabaseAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data } = await sb
    .schema("cosme_check")
    .from("coherence_analyses")
    .select("result_json")
    .gte("created_at", today.toISOString());

  const counts: Record<CoherenceVerdict, number> = {
    tenu: 0,
    partiel: 0,
    non_tenu: 0,
    hors_sujet: 0,
  };
  let total = 0;

  for (const row of (data ?? []) as Array<{ result_json: CoherenceResultJson }>) {
    const promises = row.result_json?.promises ?? [];
    for (const p of promises) {
      const v = (p.verdict ?? "").toLowerCase();
      if (v === "tenu" || v === "partiel" || v === "non_tenu" || v === "hors_sujet") {
        counts[v] += 1;
        total += 1;
      }
    }
  }

  return { total, counts };
}
