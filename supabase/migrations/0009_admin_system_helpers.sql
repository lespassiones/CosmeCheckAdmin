-- ─────────────────────────────────────────────────────────────────────────
-- 0009_admin_system_helpers.sql
-- Helper RPCs used by the admin dashboard /system page.
--
--   public.cosme_check_admin_get_cron_jobs()  → exposes pg_cron status
--   public.cosme_check_admin_table_stats()    → exposes row counts + sizes
--
-- Both are SECURITY DEFINER and revoked from PUBLIC/anon/authenticated;
-- only service_role (used by the admin dashboard via supabaseAdmin())
-- can call them. They intentionally never accept user input — no SQLi
-- surface, no parameters at all.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cosme_check_admin_get_cron_jobs()
RETURNS TABLE (
  jobname text,
  schedule text,
  latest_run timestamptz,
  latest_status text,
  latest_message text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = cron, public
AS $$
  SELECT
    j.jobname,
    j.schedule,
    r.start_time,
    r.status,
    r.return_message
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) r ON true
  WHERE j.jobname LIKE 'cosme_check_%';
$$;

REVOKE EXECUTE ON FUNCTION public.cosme_check_admin_get_cron_jobs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cosme_check_admin_get_cron_jobs() TO service_role;


CREATE OR REPLACE FUNCTION public.cosme_check_admin_table_stats()
RETURNS TABLE (
  schema_name text,
  table_name  text,
  n_live_tup  bigint,
  size_bytes  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    schemaname::text,
    relname::text,
    n_live_tup,
    pg_total_relation_size(format('%I.%I', schemaname, relname))
  FROM pg_stat_user_tables
  WHERE schemaname IN ('cosme_check', 'public')
  ORDER BY n_live_tup DESC NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.cosme_check_admin_table_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cosme_check_admin_table_stats() TO service_role;
