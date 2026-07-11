/**
 * Server-only queries for the /system infrastructure page.
 *
 * Uses two SECURITY DEFINER helpers exposed in migration 0009:
 *   - public.cosme_check_admin_get_cron_jobs()
 *   - public.cosme_check_admin_table_stats()
 *
 * The supabase_migrations.schema_migrations table is queried directly —
 * its schema is whitelisted in the project's exposed_schemas by default.
 *
 * If the migration hasn't been applied yet, the RPC calls return a
 * "function does not exist" error which we map to an empty array so the
 * page can render an instruction banner instead of crashing.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type CronJobStatus = {
  jobname: string;
  schedule: string;
  latest_run: string | null;
  latest_status: string | null;
  latest_message: string | null;
};

export type TableStat = {
  schema_name: string;
  table_name: string;
  n_live_tup: number;
  size_bytes: number;
};

export type AppliedMigration = {
  version: string;
  name: string | null;
};

export type CronResult = {
  rows: CronJobStatus[];
  /** True when the RPC itself is missing — usually means migration 0009 isn't applied yet. */
  needsMigration: boolean;
};

export type TableStatsResult = {
  rows: TableStat[];
  needsMigration: boolean;
};

/** Distinguish "RPC not found" (= migration missing) from other Postgres errors. */
function isMissingFunctionError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  // Postgres "undefined_function" SQLSTATE
  if (err.code === "42883") return true;
  // PostgREST surfaces it with code PGRST202 ("Could not find the function")
  if (err.code === "PGRST202") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("does not exist") && msg.includes("function");
}

export async function fetchCronJobs(): Promise<CronResult> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_get_cron_jobs");
  if (error) {
    if (isMissingFunctionError(error)) {
      return { rows: [], needsMigration: true };
    }
    // Don't crash the page on transient errors — surface as empty + log.
    console.error("[system] fetchCronJobs failed", error);
    return { rows: [], needsMigration: false };
  }
  const rows = (data ?? []) as CronJobStatus[];
  return {
    rows: rows.slice().sort((a, b) => a.jobname.localeCompare(b.jobname)),
    needsMigration: false,
  };
}

export async function fetchTableStats(): Promise<TableStatsResult> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_table_stats");
  if (error) {
    if (isMissingFunctionError(error)) {
      return { rows: [], needsMigration: true };
    }
    console.error("[system] fetchTableStats failed", error);
    return { rows: [], needsMigration: false };
  }
  // Sort by size desc so the biggest tables surface first.
  const rows = (data ?? []) as TableStat[];
  return {
    rows: rows
      .slice()
      .sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0)),
    needsMigration: false,
  };
}

export async function fetchAppliedMigrations(): Promise<AppliedMigration[]> {
  const sb = supabaseAdmin();
  // schema_migrations is in the supabase_migrations schema — we read via
  // .schema() rather than a raw RPC since it's already exposed.
  const { data, error } = await sb
    .schema("supabase_migrations")
    .from("schema_migrations")
    .select("version, name")
    .order("version", { ascending: false });

  if (error) {
    console.error("[system] fetchAppliedMigrations failed", error);
    return [];
  }
  return (data ?? []) as AppliedMigration[];
}

/** Bilan de santé consolidé (même RPC que la surveillance automatique). */
export type PlatformHealthData = {
  errors_last_hour: number;
  ai_errors_last_hour: number;
  ai_cost_today_estimated_usd: number;
  ai_cost_daily_threshold_usd: number | null;
  crons: { jobname: string; schedule: string; active: boolean; last_success: string | null; last_status: string | null }[];
  checked_at: string;
};

export async function fetchPlatformHealth(): Promise<PlatformHealthData | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_health");
  if (error || !data) {
    console.error("[system] fetchPlatformHealth failed", error);
    return null;
  }
  return data as PlatformHealthData;
}
