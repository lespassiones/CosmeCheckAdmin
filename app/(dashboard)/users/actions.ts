"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Set the user's daily credit limit for today. */
export async function setDailyLimit(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const newLimit = Number(formData.get("limit") ?? 0);

  if (!userId || !Number.isFinite(newLimit) || newLimit < 0 || newLimit > 100_000) {
    return { ok: false, error: "Limite invalide." };
  }

  const sb = supabaseAdmin();
  const { error } = await sb.rpc("cosme_check_admin_set_daily_limit", {
    p_user_id: userId,
    p_new_limit: Math.floor(newLimit),
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "credits.set_limit",
    targetUserId: userId,
    payload: { new_limit: Math.floor(newLimit) },
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
