/**
 * Server-side reads for the Security & Abuse Monitoring page.
 *
 * Sources (all in cosme_check schema, all read via supabaseAdmin):
 *   - error_log         → runtime errors + stack traces
 *   - rate_limits       → per-key counters (burst:<ip> is what middleware writes)
 *   - user_credits      → today's row per user (used vs daily_limit)
 *   - admin_audit_log   → forensic trail of admin actions
 *   - auth.users        → emails are resolved via listUsers() (admin API)
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// ─── KPI cards ────────────────────────────────────────────────────────────

export type SecurityKpis = {
  errors24h: number;
  rateLimitedIps: number;
  creditsExhaustedToday: number;
  adminActions24h: number;
};

/** Rate-limit counter threshold above which a key is considered "abusive". */
const BURST_THRESHOLD = 20;

export async function fetchSecurityKpis(): Promise<SecurityKpis> {
  const sb = supabaseAdmin();
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const todayKey = new Date().toISOString().slice(0, 10);

  const [errorsRes, rateLimitsRes, creditsRes, adminRes] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("error_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneDayAgo.toISOString()),
    // Bursts are keyed "burst:<ip>". We only count those above the threshold.
    sb
      .schema("cosme_check")
      .from("rate_limits")
      .select("key, count")
      .like("key", "burst:%")
      .gt("count", BURST_THRESHOLD),
    sb
      .schema("cosme_check")
      .from("user_credits")
      .select("user_id, used, daily_limit")
      .eq("day", todayKey),
    sb
      .schema("cosme_check")
      .from("admin_audit_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneDayAgo.toISOString()),
  ]);

  // Distinct IPs (the key already encodes the IP — same key would dedupe at
  // the PK level, but we keep the Set in case schema evolves).
  const ipSet = new Set<string>();
  for (const row of (rateLimitsRes.data ?? []) as { key: string }[]) {
    ipSet.add(row.key);
  }

  const creditsRows = (creditsRes.data ?? []) as Array<{
    user_id: string;
    used: number;
    daily_limit: number;
  }>;
  const creditsExhaustedToday = creditsRows.filter(
    (r) => r.daily_limit > 0 && r.used >= r.daily_limit,
  ).length;

  return {
    errors24h: errorsRes.count ?? 0,
    rateLimitedIps: ipSet.size,
    creditsExhaustedToday,
    adminActions24h: adminRes.count ?? 0,
  };
}

// ─── Error log feed ───────────────────────────────────────────────────────

export type ErrorLogRow = {
  id: number;
  route: string | null;
  error: string | null;
  stack: string | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
};

/**
 * Last `limit` entries from `error_log`, optionally filtered by route prefix.
 * Emails are resolved from a cached auth-users map (single listUsers() call).
 */
export async function fetchErrorLog(opts: {
  routePrefix?: string;
  limit?: number;
}): Promise<ErrorLogRow[]> {
  const sb = supabaseAdmin();
  const limit = Math.min(200, Math.max(10, opts.limit ?? 50));

  let query = sb
    .schema("cosme_check")
    .from("error_log")
    .select("id, route, error, stack, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.routePrefix && opts.routePrefix.trim().length > 0) {
    // `ilike` on `route LIKE '<prefix>%'` for case-insensitive prefix match.
    query = query.ilike("route", `${opts.routePrefix.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as Array<{
    id: number;
    route: string | null;
    error: string | null;
    stack: string | null;
    user_id: string | null;
    created_at: string;
  }>;

  const emailById = await buildAuthEmailMap(sb);

  return rows.map((r) => ({
    id: r.id,
    route: r.route,
    error: r.error,
    stack: r.stack,
    user_id: r.user_id,
    user_email: r.user_id ? emailById.get(r.user_id) ?? null : null,
    created_at: r.created_at,
  }));
}

// ─── Top rate-limited IPs ─────────────────────────────────────────────────

export type RateLimitedIpRow = {
  key: string;
  ip: string;
  count: number;
  window_start: string;
};

export async function fetchTopRateLimitedIps(limit = 20): Promise<RateLimitedIpRow[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .schema("cosme_check")
    .from("rate_limits")
    .select("key, count, window_start")
    .like("key", "burst:%")
    .order("count", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<{ key: string; count: number; window_start: string }>).map((r) => ({
    key: r.key,
    // burst:<ip>  → strip the "burst:" prefix to get the bare IP.
    ip: r.key.startsWith("burst:") ? r.key.slice("burst:".length) : r.key,
    count: r.count,
    window_start: r.window_start,
  }));
}

// ─── Credits exhausted today ──────────────────────────────────────────────

export type CreditsExhaustedRow = {
  user_id: string;
  email: string;
  used: number;
  daily_limit: number;
};

export async function fetchCreditsExhaustedToday(): Promise<CreditsExhaustedRow[]> {
  const sb = supabaseAdmin();
  const todayKey = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .schema("cosme_check")
    .from("user_credits")
    .select("user_id, used, daily_limit")
    .eq("day", todayKey);

  if (error || !data) return [];

  const rows = (data as Array<{ user_id: string; used: number; daily_limit: number }>).filter(
    (r) => r.daily_limit > 0 && r.used >= r.daily_limit,
  );
  if (rows.length === 0) return [];

  const emailById = await buildAuthEmailMap(sb);

  return rows
    .map((r) => ({
      user_id: r.user_id,
      email: emailById.get(r.user_id) ?? "—",
      used: r.used,
      daily_limit: r.daily_limit,
    }))
    // Heaviest abusers first.
    .sort((a, b) => b.used / b.daily_limit - a.used / a.daily_limit);
}

// ─── Admin audit log ──────────────────────────────────────────────────────

export type AdminAuditRow = {
  id: number;
  admin_email: string | null;
  action: string;
  target_user_id: string | null;
  target_user_email: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

export async function fetchAdminAuditLog(limit = 30): Promise<AdminAuditRow[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .schema("cosme_check")
    .from("admin_audit_log")
    .select("id, admin_email, action, target_user_id, payload, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as Array<{
    id: number;
    admin_email: string | null;
    action: string;
    target_user_id: string | null;
    payload: Record<string, unknown> | null;
    ip: string | null;
    created_at: string;
  }>;

  const emailById = await buildAuthEmailMap(sb);

  return rows.map((r) => ({
    id: r.id,
    admin_email: r.admin_email,
    action: r.action,
    target_user_id: r.target_user_id,
    target_user_email: r.target_user_id ? emailById.get(r.target_user_id) ?? null : null,
    payload: r.payload,
    ip: r.ip,
    created_at: r.created_at,
  }));
}

// ─── helpers ──────────────────────────────────────────────────────────────

/**
 * Builds an in-memory id → email map from auth.users via the admin API.
 * One paginated call (perPage: 1000) covers our current install. We avoid
 * caching across requests so suspended/deleted accounts disappear immediately.
 */
async function buildAuthEmailMap(
  sb: ReturnType<typeof supabaseAdmin>,
): Promise<Map<string, string>> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const u of data.users) {
    if (u.email) map.set(u.id, u.email);
  }
  return map;
}
