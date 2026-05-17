-- ─────────────────────────────────────────────────────────────────────────
-- 0010_admin_credit_settings.sql
-- Helper RPCs used by the admin dashboard /settings page to manage the
-- *global* daily credit allowance.
--
--   public.cosme_check_admin_get_credit_settings()
--     → returns the current column DEFAULT for daily_limit + today's stats
--
--   public.cosme_check_admin_set_default_daily_limit(p_new_default int,
--                                                    p_cascade_today bool,
--                                                    p_scope text)
--     → updates the DEFAULT and optionally cascades the new value to every
--       today's row, scoped by tier ('all' | 'free' | 'premium').
--
-- Both are SECURITY DEFINER and revoked from PUBLIC/anon/authenticated;
-- only service_role (used by the admin dashboard via supabaseAdmin())
-- can call them.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cosme_check_admin_get_credit_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, information_schema, public
AS $$
DECLARE
  v_default INT;
  v_today_rows INT;
  v_today_avg NUMERIC;
  v_today_min INT;
  v_today_max INT;
BEGIN
  SELECT NULLIF(regexp_replace(column_default, '\D', '', 'g'), '')::int
  INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'cosme_check'
    AND table_name = 'user_credits'
    AND column_name = 'daily_limit';

  SELECT count(*), avg(daily_limit), min(daily_limit), max(daily_limit)
  INTO v_today_rows, v_today_avg, v_today_min, v_today_max
  FROM cosme_check.user_credits
  WHERE day = CURRENT_DATE;

  RETURN jsonb_build_object(
    'default_daily_limit', v_default,
    'today_rows', COALESCE(v_today_rows, 0),
    'today_avg_limit', COALESCE(round(v_today_avg), 0),
    'today_min_limit', COALESCE(v_today_min, 0),
    'today_max_limit', COALESCE(v_today_max, 0)
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.cosme_check_admin_get_credit_settings() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cosme_check_admin_get_credit_settings() TO service_role;


CREATE OR REPLACE FUNCTION public.cosme_check_admin_set_default_daily_limit(
  p_new_default INT,
  p_cascade_today BOOLEAN DEFAULT false,
  p_scope TEXT DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cosme_check, public
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  IF p_new_default < 0 OR p_new_default > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_default');
  END IF;
  IF p_scope NOT IN ('all', 'free', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_scope');
  END IF;

  EXECUTE format(
    'ALTER TABLE cosme_check.user_credits ALTER COLUMN daily_limit SET DEFAULT %s',
    p_new_default::text
  );

  IF p_cascade_today THEN
    IF p_scope = 'free' THEN
      UPDATE cosme_check.user_credits uc
      SET daily_limit = p_new_default
      FROM cosme_check.user_profiles p
      WHERE uc.user_id = p.id
        AND uc.day = CURRENT_DATE
        AND COALESCE(p.tier, 'free') <> 'premium';
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF p_scope = 'premium' THEN
      UPDATE cosme_check.user_credits uc
      SET daily_limit = p_new_default
      FROM cosme_check.user_profiles p
      WHERE uc.user_id = p.id
        AND uc.day = CURRENT_DATE
        AND p.tier = 'premium';
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
      UPDATE cosme_check.user_credits
      SET daily_limit = p_new_default
      WHERE day = CURRENT_DATE;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'new_default', p_new_default,
    'cascaded_rows', v_updated,
    'scope', p_scope
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.cosme_check_admin_set_default_daily_limit(int, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cosme_check_admin_set_default_daily_limit(int, boolean, text) TO service_role;
