"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Editable global app settings (rebuilt Paramètres page). */
export type AppConfigPatch = {
  signup_default_tier?: "free" | "premium";
  signups_open?: boolean;
  flag_deep_search?: boolean;
  flag_suggestions?: boolean;
  flag_advisor?: boolean;
  flag_public_share?: boolean;
  // Flags rétention (juil 2026)
  flag_routine_reorganize?: boolean;
  flag_conflicts?: boolean;
  flag_skin_score?: boolean;
  flag_weekly_picks?: boolean;
  // Notifications
  notif_reminders_enabled?: boolean;
  notif_bilan_weekday?: number;
  notif_bilan_hour?: number;
  notif_conflict_alerts?: boolean;
  ai_cost_alert_daily_usd?: string;
  ai_cost_alert_monthly_usd?: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
};

/**
 * Persist global app config (cosme_check.app_config). Only the keys present in
 * `patch` are changed. Apps read the public subset via cosme_check_get_app_config.
 */
export async function saveAppConfig(patch: AppConfigPatch): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_set_app_config", {
    p: { ...patch, updated_by: admin.email },
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "settings.update",
    payload: patch as Record<string, unknown>,
  });

  revalidatePath("/settings");
  return { ok: true };
}
