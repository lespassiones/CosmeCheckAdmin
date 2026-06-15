"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type PhotoActionResult = { ok: true } | { ok: false; error: string };

/** Définit (ou remplace) l'image d'un produit du catalogue depuis une URL. */
export async function setCatalogImage(ean: string, rawUrl: string): Promise<PhotoActionResult> {
  const admin = await requireAdmin();
  const url = (rawUrl ?? "").trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    return { ok: false, error: "URL d'image invalide (doit commencer par http)." };
  }
  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("catalog")
    .update({ image_url: url.slice(0, 1000) })
    .eq("ean", ean);
  if (error) return { ok: false, error: error.message };
  await logAudit({ adminEmail: admin.email, action: "catalog.set_image", payload: { ean, url } });
  revalidatePath(`/catalog/database/${encodeURIComponent(ean)}`);
  return { ok: true };
}

/** Retire l'image d'un produit du catalogue. */
export async function clearCatalogImage(ean: string): Promise<PhotoActionResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("catalog")
    .update({ image_url: null })
    .eq("ean", ean);
  if (error) return { ok: false, error: error.message };
  await logAudit({ adminEmail: admin.email, action: "catalog.clear_image", payload: { ean } });
  revalidatePath(`/catalog/database/${encodeURIComponent(ean)}`);
  return { ok: true };
}
