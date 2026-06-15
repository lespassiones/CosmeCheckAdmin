"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BUCKET = "cosmetwiki-products";

type SubmissionRow = {
  id: string;
  ean: string | null;
  brand: string | null;
  name: string | null;
  category: string | null;
  photo_path_1: string;
  photo_path_2: string | null;
  status: string;
};

/**
 * Valide une photo proposée : la photo choisie (path) devient l'image du
 * produit (catalog.image_url). Si le produit a un EAN → on met à jour la ligne
 * catalogue ; sinon on crée une ligne catalogue synthétique (produit hors
 * code-barres). La soumission passe à 'approved'.
 */
export async function approvePhotoSubmission(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const submissionId = String(formData.get("submission_id") ?? "").trim();
  const chosenPath = String(formData.get("photo_path") ?? "").trim();
  if (!submissionId) return { ok: false, error: "Identifiant manquant." };
  if (!chosenPath) return { ok: false, error: "Aucune photo sélectionnée." };

  const sb = supabaseAdmin();

  const { data: sub, error: subErr } = await sb
    .schema("cosme_check")
    .from("catalog_photo_submissions")
    .select("id, ean, brand, name, category, photo_path_1, photo_path_2, status")
    .eq("id", submissionId)
    .single();

  if (subErr || !sub) return { ok: false, error: "Soumission introuvable." };
  const submission = sub as SubmissionRow;

  // La photo choisie doit appartenir à cette soumission.
  if (chosenPath !== submission.photo_path_1 && chosenPath !== submission.photo_path_2) {
    return { ok: false, error: "Photo invalide pour cette soumission." };
  }

  const imageUrl = sb.storage.from(BUCKET).getPublicUrl(chosenPath).data.publicUrl;

  if (submission.ean) {
    // Produit catalogue : met à jour l'image. Upsert pour couvrir le cas (rare)
    // où la ligne n'existerait pas encore.
    const { error: upErr } = await sb
      .schema("cosme_check")
      .from("catalog")
      .upsert(
        {
          ean: submission.ean,
          brand: submission.brand,
          name: submission.name,
          category: submission.category,
          image_url: imageUrl,
          is_active: true,
        },
        { onConflict: "ean" },
      );
    if (upErr) return { ok: false, error: upErr.message };
  } else {
    // Produit hors code-barres : ligne catalogue synthétique (clé déterministe).
    const syntheticEan = `cc-photo-${submission.id}`;
    const { error: insErr } = await sb
      .schema("cosme_check")
      .from("catalog")
      .upsert(
        {
          ean: syntheticEan,
          brand: submission.brand,
          name: submission.name,
          category: submission.category,
          image_url: imageUrl,
          is_active: true,
        },
        { onConflict: "ean" },
      );
    if (insErr) return { ok: false, error: insErr.message };
  }

  const { error: stErr } = await sb
    .schema("cosme_check")
    .from("catalog_photo_submissions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq("id", submissionId);
  if (stErr) return { ok: false, error: stErr.message };

  await logAudit({
    adminEmail: admin.email,
    action: "product_photo.approve",
    payload: { submission_id: submissionId, ean: submission.ean, chosen_path: chosenPath },
  });

  revalidatePath("/feedback/products");
  return { ok: true };
}

/**
 * Rejette une photo proposée (status='rejected'). Si cette photo était l'image
 * actuelle du produit (cas d'une re-modification après validation), on la RETIRE
 * du catalogue : image nullifiée pour un produit à EAN, ligne synthétique
 * désactivée pour un produit hors code-barres.
 */
export async function rejectPhotoSubmission(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const submissionId = String(formData.get("submission_id") ?? "").trim();
  if (!submissionId) return { ok: false, error: "Identifiant manquant." };

  const sb = supabaseAdmin();

  const { data: sub } = await sb
    .schema("cosme_check")
    .from("catalog_photo_submissions")
    .select("id, ean, photo_path_1, photo_path_2")
    .eq("id", submissionId)
    .single();
  const submission = sub as
    | { id: string; ean: string | null; photo_path_1: string; photo_path_2: string | null }
    | null;

  // Revert de l'image si elle provenait bien de cette soumission.
  if (submission) {
    const urls = [submission.photo_path_1, submission.photo_path_2]
      .filter((p): p is string => !!p)
      .map((p) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl);

    if (submission.ean) {
      const { data: cat } = await sb
        .schema("cosme_check")
        .from("catalog")
        .select("image_url")
        .eq("ean", submission.ean)
        .single();
      const current = (cat as { image_url: string | null } | null)?.image_url ?? null;
      if (current && urls.includes(current)) {
        await sb
          .schema("cosme_check")
          .from("catalog")
          .update({ image_url: null })
          .eq("ean", submission.ean);
      }
    } else {
      await sb
        .schema("cosme_check")
        .from("catalog")
        .update({ image_url: null, is_active: false })
        .eq("ean", `cc-photo-${submission.id}`);
    }
  }

  const { error } = await sb
    .schema("cosme_check")
    .from("catalog_photo_submissions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq("id", submissionId);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: admin.email,
    action: "product_photo.reject",
    payload: { submission_id: submissionId, reverted_image: !!submission },
  });

  revalidatePath("/feedback/products");
  return { ok: true };
}
