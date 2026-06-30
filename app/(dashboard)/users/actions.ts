"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PERIODS = ["one_time", "daily", "weekly", "monthly", "yearly"] as const;
type Period = (typeof PERIODS)[number];

/**
 * Grant one-off BONUS credits to a user (additive, non-renewable). These sit on
 * top of the renewal allocation and are consumed only once the period quota is
 * exhausted — exactly "donner X crédits" without touching the daily limit.
 * Works immediately on web AND mobile (both read cosme_check_get_credits).
 */
export async function grantBonusCredits(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").slice(0, 300) || null;
  if (!userId) return { ok: false, error: "user_id manquant." };
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000) {
    return { ok: false, error: "Montant invalide." };
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_grant_credits", {
    p_user_id: userId,
    p_amount: Math.floor(amount),
    p_note: note,
    p_admin: admin.email,
  });
  if (error) return { ok: false, error: error.message };
  if (data && (data as { ok?: boolean }).ok === false) {
    return { ok: false, error: (data as { error?: string }).error ?? "Échec." };
  }

  await logAudit({
    adminEmail: admin.email,
    action: "credits.grant_bonus",
    targetUserId: userId,
    payload: { amount: Math.floor(amount), note },
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

/**
 * Set a per-user credit OVERRIDE (replaces the tier config for this user):
 * a custom amount + renewal period. Use for "ce user a 50 crédits / semaine".
 */
export async function setUserOverride(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const period = String(formData.get("period") ?? "") as Period;
  if (!userId) return { ok: false, error: "user_id manquant." };
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000) {
    return { ok: false, error: "Montant invalide." };
  }
  if (!PERIODS.includes(period)) return { ok: false, error: "Période invalide." };

  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_set_override", {
    p_user_id: userId,
    p_credit_amount: Math.floor(amount),
    p_renewal_period: period,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "credits.override_set",
    targetUserId: userId,
    payload: { amount: Math.floor(amount), period },
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

/** Remove a per-user override (revert to the tier config). */
export async function clearUserOverride(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "user_id manquant." };

  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_clear_override", { p_user_id: userId });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "credits.override_clear",
    targetUserId: userId,
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

/** Reset today's `used` counter to 0. */
export async function resetCreditsToday(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "user_id manquant." };

  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_reset_today", { p_user_id: userId });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "credits.reset_today",
    targetUserId: userId,
  });

  revalidatePath(`/users/${userId}`);
  return { ok: true };
}

/** Suspend a user (apiGate will refuse to consume credits). */
export async function suspendUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "user_id manquant." };

  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .update({ suspended_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "user.suspend",
    targetUserId: userId,
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

export async function unsuspendUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "user_id manquant." };

  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .update({ suspended_at: null })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "user.unsuspend",
    targetUserId: userId,
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

/** Hard delete a user. Cascades via auth.users ON DELETE CASCADE. */
export async function deleteUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!userId) return { ok: false, error: "user_id manquant." };
  if (confirm !== "DELETE") return { ok: false, error: "Confirmation invalide." };

  const sb = supabaseAdmin();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "user.delete",
    targetUserId: userId,
  });

  revalidatePath("/users");
  return { ok: true };
}

/** Trigger a password reset email. */
export async function sendPasswordReset(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "");
  if (!email.includes("@")) return { ok: false, error: "Email invalide." };

  const sb = supabaseAdmin();
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "user.send_password_reset",
    payload: { email },
  });

  return { ok: true };
}
