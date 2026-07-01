"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { syncOpenAiCosts } from "@/lib/openai/costs";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SyncActionResult = { ok: true; days: number } | { ok: false; error: string };

/**
 * Synchronise les coûts OpenAI RÉELS depuis l'API Costs (source de vérité).
 * Backfill/refresh de cosme_check.openai_cost_daily. Nécessite OPENAI_ADMIN_KEY.
 */
export async function refreshOpenAiCosts(): Promise<SyncActionResult> {
  const admin = await requireAdmin();
  const res = await syncOpenAiCosts({ days: 180 });
  if (!res.ok) return { ok: false, error: res.error ?? "Échec de synchronisation." };
  await logAudit({ adminEmail: admin.email, action: "ai.sync_openai_costs" });
  revalidatePath("/ai");
  return { ok: true, days: res.days };
}

/**
 * Wipes the entire `cosme_check.ai_cache` table.
 *
 * Use case: a prompt/model change just landed and previously-cached LLM
 * results are now stale or incorrect — we force a re-fetch on every call.
 */
export async function purgeAiCache(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "PURGE") return { ok: false, error: "Confirmation invalide." };

  const sb = supabaseAdmin();
  // Supabase PostgREST forbids unconditional DELETE — using `not is null` on
  // the PK matches every row and gives us a "delete all" we can audit.
  const { error } = await sb
    .schema("cosme_check")
    .from("ai_cache")
    .delete()
    .not("cache_key", "is", null);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "cache.purge_ai",
  });

  revalidatePath("/ai");
  return { ok: true };
}

/**
 * Wipes the entire `cosme_check.product_inci_cache` table.
 *
 * Use case: source quality changed (new scrapers, new normalization) and we
 * want to force every product lookup to be re-fetched from upstream sources.
 */
export async function purgeProductInciCache(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "PURGE") return { ok: false, error: "Confirmation invalide." };

  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("product_inci_cache")
    .delete()
    .not("id", "is", null);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "cache.purge_product_inci",
  });

  revalidatePath("/ai");
  return { ok: true };
}
