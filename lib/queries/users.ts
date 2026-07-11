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
import { rowCost } from "@/lib/queries/ai";

/** Renewal period of a tier/override config. */
export type RenewalPeriod = "one_time" | "daily" | "weekly" | "monthly" | "yearly";

export type UserListRow = {
  id: string;
  email: string;
  first_name: string | null;
  tier: "free" | "premium";
  created_at: string;
  last_sign_in_at: string | null;
  suspended_at: string | null;
  /** Credits used in the CURRENT renewal period (not just today). */
  credits_used_today: number;
  /** Effective period limit (tier or override). */
  credits_limit_today: number;
  /** Active bonus credits (additive, non-renewable). */
  credits_bonus: number;
  /** Effective renewal period (per-user override wins over tier). */
  renewal_period: RenewalPeriod;
};

/** One row of cosme_check_admin_users_overview(). */
type OverviewRow = {
  user_id: string;
  tier: string;
  has_override: boolean;
  credit_amount: number;
  renewal_period: RenewalPeriod;
  used_period: number;
  bonus: number;
  remaining: number;
};

async function fetchOverviewMap(
  sb: ReturnType<typeof supabaseAdmin>,
): Promise<Map<string, OverviewRow>> {
  const { data } = await sb.rpc("cosme_check_admin_users_overview");
  const map = new Map<string, OverviewRow>();
  for (const r of (data as OverviewRow[] | null) ?? []) map.set(r.user_id, r);
  return map;
}

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

  // 3. Canonical credit overview: effective config + used-this-period + bonus.
  const overview = await fetchOverviewMap(sb);

  // 3b. Vraie « dernière activité » (dernier scan OU dernière action IA).
  // auth.last_sign_in_at ne bouge qu'à une vraie connexion : avec la session
  // persistante de l'app, un utilisateur actif chaque jour affichait « il y a
  // 4 j ». On prend le max(activité, last_sign_in).
  const lastActivity = new Map<string, string>();
  try {
    const { data: acts } = await sb.rpc("cosme_check_admin_last_activity");
    for (const r of (acts as { user_id: string; last_activity: string }[] | null) ?? []) {
      lastActivity.set(r.user_id, r.last_activity);
    }
  } catch {
    // best-effort : on retombe sur last_sign_in_at seul.
  }

  const profilesMap = new Map(
    ((profiles ?? []) as { id: string; first_name: string | null; tier: string | null; suspended_at: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  );

  let rows: UserListRow[] = authPage.users.map((u) => {
    const p = profilesMap.get(u.id);
    const o = overview.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      first_name: p?.first_name ?? null,
      tier: (p?.tier === "premium" ? "premium" : "free") as "free" | "premium",
      created_at: u.created_at,
      last_sign_in_at: (() => {
        const signIn = u.last_sign_in_at ?? null;
        const act = lastActivity.get(u.id) ?? null;
        if (!signIn) return act;
        if (!act) return signIn;
        return act > signIn ? act : signIn;
      })(),
      suspended_at: p?.suspended_at ?? null,
      credits_used_today: o?.used_period ?? 0,
      credits_limit_today: o?.credit_amount ?? 5,
      credits_bonus: o?.bonus ?? 0,
      renewal_period: o?.renewal_period ?? "daily",
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

/** A single bonus-credit grant on a user's ledger. */
export type CreditGrant = {
  id: number;
  amount: number;
  remaining: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type UserDetail = UserListRow & {
  // Provider/auth metadata
  provider: string | null;
  email_confirmed_at: string | null;
  // Credit config
  has_override: boolean;
  grants: CreditGrant[];
  // Totals
  total_analyses: number;
  total_coherence: number;
  total_barcode_scans: number;
  total_advisor_msgs: number;
  total_ai_tokens_in: number;
  total_ai_tokens_out: number;
  /** Estimated lifetime AI spend in USD (tokens at per-model price + web fees). */
  total_ai_cost_usd: number;
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

/** Shape returned by cosme_check_admin_user_credits(p_user_id). */
type UserCreditsState = {
  used: number;
  limit: number;
  remaining: number;
  bonus: number;
  renewal_period: RenewalPeriod;
  has_override: boolean;
  grants: CreditGrant[];
};

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const sb = supabaseAdmin();
  // Auth row first — confirms the user exists.
  const { data: authData, error: authErr } = await sb.auth.admin.getUserById(userId);
  if (authErr || !authData.user) return null;
  const u = authData.user;

  const [
    profileRes,
    creditStateRes,
    creditHistoryRes,
    analysesCountRes,
    coherenceCountRes,
    barcodeCountRes,
    advisorCountRes,
    aiLogsRes,
    recentAnalysesRes,
    routineRes,
  ] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("user_profiles")
      .select("first_name, tier, suspended_at")
      .eq("id", userId)
      .maybeSingle(),
    sb.rpc("cosme_check_admin_user_credits", { p_user_id: userId }),
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
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "barcode"),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", "synthesis"),
    sb
      .schema("cosme_check")
      .from("ai_logs")
      .select("model, provider, tokens_in, tokens_out")
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
      .select("analysis_id, frequency, added_at, analyses(name, product_label, score)")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data as { first_name: string | null; tier: string | null; suspended_at: string | null } | null;
  const state = (creditStateRes.data as UserCreditsState | null) ?? null;

  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  for (const row of (aiLogsRes.data ?? []) as Array<{
    model: string | null; provider: string | null; tokens_in: number | null; tokens_out: number | null;
  }>) {
    tokensIn += row.tokens_in ?? 0;
    tokensOut += row.tokens_out ?? 0;
    costUsd += rowCost(row);
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
    credits_used_today: state?.used ?? 0,
    credits_limit_today: state?.limit ?? 5,
    credits_bonus: state?.bonus ?? 0,
    renewal_period: state?.renewal_period ?? "daily",
    has_override: state?.has_override ?? false,
    grants: state?.grants ?? [],
    provider,
    email_confirmed_at: u.email_confirmed_at ?? null,
    total_analyses: analysesCountRes.count ?? 0,
    total_coherence: coherenceCountRes.count ?? 0,
    total_barcode_scans: barcodeCountRes.count ?? 0,
    total_advisor_msgs: advisorCountRes.count ?? 0,
    total_ai_tokens_in: tokensIn,
    total_ai_tokens_out: tokensOut,
    total_ai_cost_usd: costUsd,
    credit_history: ((creditHistoryRes.data ?? []) as Array<{
      day: string;
      used: number;
      daily_limit: number;
    }>).reverse(),
    recent_analyses: (recentAnalysesRes.data ?? []) as UserDetail["recent_analyses"],
    // Supabase returns the related `analyses` row as an array even on
    // many-to-one joins. Flatten to the first entry; fall back name -> product_label.
    routine_items: ((routineRes.data ?? []) as unknown as Array<{
      analysis_id: string;
      frequency: string | null;
      added_at: string;
      analyses: { name: string | null; product_label: string | null; score: number | null }[] | { name: string | null; product_label: string | null; score: number | null } | null;
    }>).map((r) => {
      const a = Array.isArray(r.analyses) ? r.analyses[0] : r.analyses;
      return {
        analysis_id: r.analysis_id,
        frequency: r.frequency,
        added_at: r.added_at,
        product_label: a?.product_label ?? a?.name ?? null,
        score: a?.score ?? null,
      };
    }),
  };
}
