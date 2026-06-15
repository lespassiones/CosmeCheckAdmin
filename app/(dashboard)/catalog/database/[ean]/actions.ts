"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

const BUCKET = "cosmetwiki-products";

export type PhotoActionResult = { ok: true; url?: string } | { ok: false; error: string };

/**
 * Upload d'une image DÉJÀ compressée côté navigateur (WebP ≤ ~800px). On ne
 * stocke QUE cette version optimisée (l'originale ne quitte jamais le PC). On
 * borne à 2 Mo par sécurité (la compression client tombe bien en dessous).
 */
export async function uploadCatalogImage(formData: FormData): Promise<PhotoActionResult> {
  const admin = await requireAdmin();
  const ean = String(formData.get("ean") ?? "").trim();
  const file = formData.get("file");
  if (!ean) return { ok: false, error: "EAN manquant." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fichier manquant." };
  if (file.size > 2_000_000) return { ok: false, error: "Image trop lourde (max 2 Mo après compression)." };

  const sb = supabaseAdmin();
  const path = `admin/${ean}-${Date.now()}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/webp", upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await sb
    .schema("cosme_check")
    .from("catalog")
    .update({ image_url: url })
    .eq("ean", ean);
  if (error) return { ok: false, error: error.message };

  await logAudit({ adminEmail: admin.email, action: "catalog.upload_image", payload: { ean, path, bytes: file.size } });
  revalidatePath(`/catalog/database/${encodeURIComponent(ean)}`);
  return { ok: true, url };
}

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
