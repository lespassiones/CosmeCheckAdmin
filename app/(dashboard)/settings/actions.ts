"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; cascadedRows: number }
  | { ok: false; error: string };

export type CreditScope = "all" | "free" | "premium";

export async function setDefaultDailyLimit(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const newDefault = Number(formData.get("new_default") ?? NaN);
  const cascadeToday = formData.get("cascade_today") === "on";
  const scopeRaw = String(formData.get("scope") ?? "all");
  const scope: CreditScope = scopeRaw === "free" || scopeRaw === "premium" ? scopeRaw : "all";

  if (!Number.isFinite(newDefault) || newDefault < 0 || newDefault > 100_000) {
    return { ok: false, error: "Valeur invalide (0–100 000)." };
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_set_default_daily_limit", {
    p_new_default: Math.floor(newDefault),
    p_cascade_today: cascadeToday,
    p_scope: scope,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { ok: boolean; error?: string; cascaded_rows?: number };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Échec inconnu." };

  await logAudit({
    adminEmail: admin.email,
    action: "credits.set_default",
    payload: {
      new_default: Math.floor(newDefault),
      cascade_today: cascadeToday,
      scope,
      cascaded_rows: result.cascaded_rows ?? 0,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/users");
  return { ok: true, cascadedRows: result.cascaded_rows ?? 0 };
}
