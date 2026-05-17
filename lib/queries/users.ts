/**
 * Per-user reads for the Users tab.
 *
 * The dashboard joins three sources :
 *   - auth.users         (Supabase Auth, via the admin API)
 *   - cosme_check.user_profiles
 *   - cosme_check.user_credits (today's row only)
 * + a handful of count() RPCs for the totals on the detail page.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type UserListRow = {
  id: string;
  email: string;
  first_name: string | null;
  tier: "free" | "premium";
  created_at: string;
  last_sign_in_at: string | null;
  suspended_at: string | null;
  credits_used_today: number;
  credits_limit_today: number;
};

export async function listUsers(opts: {
  search?: string;
  limit?: number;
}): Promise<UserListRow[]> {
  const sb = supabaseAdmin();
  const limit = Math.min(500, Math.max(10, opts.limit ?? 100));

  // 1. Pull auth users — Supabase Admin API. listUsers returns ALL users in
  //    pages of up to 1000 (max). For a 1-5 k user app this is one call.
  const { data: authPage, error: authErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr || !authPage) return [];

  const authMap = new Map(authPage.users.map((u) => [u.id, u]));

  // 2. Pull profiles in one shot (matches auth rows 1-to-1 via the trigger).
  const ids = Array.from(authMap.keys());
  if (ids.length === 0) return [];
  const { data: profiles } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .select("id, first_name, tier, suspended_at")
    .in("id", ids);

  // 3. Today's credit row, if any (user_credits is sparse — one row/user/day).
  const today = new Date().toISOString().slice(0, 10);
  const { data: credits } = await sb
    .schema("cosme_check")
    .from("user_credits")
    .select("user_id, used, daily_limit")
    .eq("day", today)
    .in("user_id", ids);

  const profilesMap = new Map(
    ((profiles ?? []) as { id: string; first_name: string | null; tier: string | null; suspended_at: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  );
  const creditsMap = new Map(
    ((credits ?? []) as { user_id: string; used: number; daily_limit: number }[]).map((c) => [
      c.user_id,
      c,
    ]),
  );

  let rows: UserListRow[] = authPage.users.map((u) => {
    const p = profilesMap.get(u.id);
    const c = creditsMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      first_name: p?.first_name ?? null,
      tier: (p?.tier === "premium" ? "premium" : "free") as "free" | "premium",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      suspended_at: p?.suspended_at ?? null,
      credits_used_today: c?.used ?? 0,
      credits_limit_today: c?.daily_limit ?? 100,
    };
  });

  // Search filter (client-side, fine at this scale).
  if (opts.search) {
    const needle = opts.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(needle)
        || (r.first_name ?? "").toLowerCase().includes(needle),
    );
  }

  // Sort: newest signup first.
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows.slice(0, limit);
}

export type UserDetail = UserListRow & {
  // Provider/auth metadata
  provider: string | null;
  email_confirmed_at: string | null;
  // Totals
  total_analyses: number;
  total_coherence: number;
  total_ocr_calls: number;
  total_advisor_msgs: number;
  total_ai_tokens_in: number;
  total_ai_tokens_out: number;
  // 30-day credit history
  credit_history: Array<{ day: string; used: number; daily_limit: number }>;
  // Recent activity
  recent_analyses: Array<{
    id: string;
    name: string | null;
    product_label: string | null;
    score: number | null;
    created_at: string;
  }>;
  // Routine snapshot
  routine_items: Array<{
    analysis_id: string;
    frequency: string | null;
    added_at: string;
    product_label: string | null;
    score: number | null;
  }>;
};

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const sb = supabaseAdmin();
  // Auth row first — confirms the user exists.
  const { data: authData, error: authErr } = await sb.auth.admin.getUserById(userId);
  if (authErr || !authData.user) return null;
  const u = authData.user;

  const [
    profileRes,
    creditTodayRes,
    creditHistoryRes,
    analysesCountRes,
    coherenceCountRes,
    ocrCountRes,
    advisorCountRes,
    aiTokensRes,
    recentAnalysesRes,
    routineRes,
  ] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("user_profiles")
      .select("first_name, tier, suspended_at")
      .eq("id", userId)
      .maybeSingle(),
    sb
      .schema("cosme_check")
      .from("user_credits")
      .select("used, daily_limit")
      .eq("user_id", userId)
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
    sb
      .schema("cosme_check")
      .from("user_credits")
      .select("day, used, daily_limit")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(30),
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    sb
      .schema("cosme_check")
      .from("coherence_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", "ocr"),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", "synthesis"),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("tokens_in, tokens_out")
      .eq("user_id", userId),
    sb
      .schema("cosme_check")
      .from("analyses")
      .select("id, name, product_label, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .schema("cosme_check")
      .from("routine_items")
      .select("analysis_id, frequency, added_at, analyses(product_label, score)")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data as { first_name: string | null; tier: string | null; suspended_at: string | null } | null;
  const today = creditTodayRes.data as { used: number; daily_limit: number } | null;

  let tokensIn = 0;
  let tokensOut = 0;
  for (const row of (aiTokensRes.data ?? []) as { tokens_in: number | null; tokens_out: number | null }[]) {
    tokensIn += row.tokens_in ?? 0;
    tokensOut += row.tokens_out ?? 0;
  }

  const provider = (u.app_metadata?.provider as string | undefined) ?? null;

  return {
    id: u.id,
    email: u.email ?? "",
    first_name: profile?.first_name ?? null,
    tier: (profile?.tier === "premium" ? "premium" : "free") as "free" | "premium",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    suspended_at: profile?.suspended_at ?? null,
    credits_used_today: today?.used ?? 0,
    credits_limit_today: today?.daily_limit ?? 100,
    provider,
    email_confirmed_at: u.email_confirmed_at ?? null,
    total_analyses: analysesCountRes.count ?? 0,
    total_coherence: coherenceCountRes.count ?? 0,
    total_ocr_calls: ocrCountRes.count ?? 0,
    total_advisor_msgs: advisorCountRes.count ?? 0,
    total_ai_tokens_in: tokensIn,
    total_ai_tokens_out: tokensOut,
    credit_history: ((creditHistoryRes.data ?? []) as Array<{
      day: string;
      used: number;
      daily_limit: number;
    }>).reverse(),
    recent_analyses: (recentAnalysesRes.data ?? []) as UserDetail["recent_analyses"],
    // Supabase returns the related `analyses` row as an array even on
    // many-to-one joins. We flatten to the first (and only) entry here so
    // the UI can read `product_label`/`score` directly.
    routine_items: ((routineRes.data ?? []) as unknown as Array<{
      analysis_id: string;
      frequency: string | null;
      added_at: string;
      analyses: { product_label: string | null; score: number | null }[] | null;
    }>).map((r) => ({
      analysis_id: r.analysis_id,
      frequency: r.frequency,
      added_at: r.added_at,
      product_label: r.analyses?.[0]?.product_label ?? null,
      score: r.analyses?.[0]?.score ?? null,
    })),
  };
}
