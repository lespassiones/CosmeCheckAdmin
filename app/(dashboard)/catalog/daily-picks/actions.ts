"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Update an existing daily pick. Called from the inline `<PickEditor>` form.
 *
 * Validation:
 *   - pick_id, question, category must be non-empty strings
 *   - options come from a newline-separated textarea, must have >= 2 entries
 *   - correct_index must be an int in [0, options.length - 1]
 */
export async function updatePick(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const pickId = String(formData.get("pick_id") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "");
  const correctIndexRaw = String(formData.get("correct_index") ?? "");
  const reveal = String(formData.get("reveal") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!pickId) return { ok: false, error: "Identifiant manquant." };
  if (!question) return { ok: false, error: "La question est requise." };

  const options = optionsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (options.length < 2) {
    return { ok: false, error: "Au moins 2 options sont requises." };
  }

  const correctIndex = Number.parseInt(correctIndexRaw, 10);
  if (
    !Number.isInteger(correctIndex)
    || correctIndex < 0
    || correctIndex >= options.length
  ) {
    return {
      ok: false,
      error: `correct_index doit être entre 0 et ${options.length - 1}.`,
    };
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("daily_picks")
    .update({
      question,
      options,
      correct_index: correctIndex,
      reveal: reveal || null,
      category: category || null,
    })
    .eq("id", pickId);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "daily_picks.update",
    payload: {
      pick_id: pickId,
      question,
      options_count: options.length,
      correct_index: correctIndex,
      category: category || null,
    },
  });

  revalidatePath("/catalog/daily-picks");
  return { ok: true };
}
