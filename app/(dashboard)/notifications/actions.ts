"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type NotifResult = { ok: true } | { ok: false; error: string };

export type AudienceSample = { user_id: string; first_name: string | null; email: string | null };
export type PreviewResult =
  | { ok: true; total: number; sample: AudienceSample[] }
  | { ok: false; error: string };

export type CampaignInput = {
  segment: string;
  title: string;
  body: string;
  deeplink?: string | null;
  /** ISO ; si absent, envoi immediat. */
  scheduledAt?: string | null;
  /** Envoyer tout de suite (declenche le dispatch apres l'enqueue). */
  dispatchNow?: boolean;
};

/** Dry-run : compte l'audience joignable + un echantillon, sans rien enfiler. */
export async function previewAudience(segment: string): Promise<PreviewResult> {
  await requireAdmin();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_notif_preview", { p_segment: segment });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { total?: number; sample?: AudienceSample[] };
  return { ok: true, total: res.total ?? 0, sample: res.sample ?? [] };
}

/** Enfile la campagne pour toute l'audience, puis envoie (ou programme). */
export async function sendCampaign(input: CampaignInput): Promise<NotifResult> {
  const admin = await requireAdmin();
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!title) return { ok: false, error: "Titre requis." };
  if (!body) return { ok: false, error: "Message requis." };

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_notif_enqueue", {
    p_segment: input.segment,
    p_title: title,
    p_body: body,
    p_deeplink: input.deeplink || null,
    p_scenario: "manual",
    p_scheduled_at: input.scheduledAt || new Date().toISOString(),
    p_admin: admin.email,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; queued?: number; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "enqueue_failed" };

  // Envoi immediat si demande ET non programme dans le futur.
  if (input.dispatchNow && !input.scheduledAt) {
    await sb.rpc("cosme_check_admin_notif_dispatch_now");
  }

  await logAudit({
    adminEmail: admin.email,
    action: "notifications.send_campaign",
    payload: { segment: input.segment, queued: res.queued, scheduled: Boolean(input.scheduledAt) },
  });
  revalidatePath("/notifications");
  return { ok: true };
}

/** Active/desactive le planner automatique (flag maitre). */
export async function setPlannerEnabled(enabled: boolean): Promise<NotifResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_set_notif_planner", { p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  await logAudit({ adminEmail: admin.email, action: "notifications.set_planner", payload: { enabled } });
  revalidatePath("/notifications");
  return { ok: true };
}

/** Active/desactive un scenario automatique. */
export async function setScenarioEnabled(key: string, enabled: boolean): Promise<NotifResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_set_scenario", { p_key: key, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "scenario_error" };
  await logAudit({ adminEmail: admin.email, action: "notifications.set_scenario", payload: { key, enabled } });
  revalidatePath("/notifications");
  return { ok: true };
}

export type DryRunResult =
  | { ok: true; scenarios: { scenario: string; audience: number; queued: number }[] }
  | { ok: false; error: string };

/** Simulation du planner (dry-run) : compte l'audience par scenario, n'enfile rien. */
export async function runPlannerDryRun(): Promise<DryRunResult> {
  await requireAdmin();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_run_notif_planner", { p_dry_run: true });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; scenarios?: { scenario: string; audience: number; queued: number }[] };
  return { ok: true, scenarios: res.scenarios ?? [] };
}

/** Envoie un test immediat a l'admin connecte (par son email). */
export async function sendTest(input: { title: string; body: string; deeplink?: string | null }): Promise<NotifResult> {
  const admin = await requireAdmin();
  const title = (input.title ?? "").trim() || "Test CosmeCheck";
  const body = (input.body ?? "").trim() || "Ceci est une notification de test.";

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_notif_test", {
    p_email: admin.email,
    p_title: title,
    p_body: body,
    p_deeplink: input.deeplink || null,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; error?: string; has_token?: boolean };
  if (!res.ok) {
    return { ok: false, error: res.error === "user_not_found" ? "Ton compte admin n'a pas d'utilisateur mobile." : (res.error ?? "test_failed") };
  }
  await sb.rpc("cosme_check_admin_notif_dispatch_now");
  await logAudit({ adminEmail: admin.email, action: "notifications.send_test" });
  revalidatePath("/notifications");
  if (!res.has_token) {
    return { ok: false, error: "Test enfile, mais ton compte n'a aucun appareil enregistre (installe l'app + active les notifs)." };
  }
  return { ok: true };
}
