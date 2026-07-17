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
    // Produit catalogue : on ne touche QUE l'image. (L'ancien upsert réécrivait
    // aussi brand/name/category avec les valeurs TAPÉES PAR L'UTILISATEUR, ce
    // qui pouvait écraser des données catalogue correctes.)
    const { data: updated, error: upErr } = await sb
      .schema("cosme_check")
      .from("catalog")
      .update({ image_url: imageUrl })
      .eq("ean", submission.ean)
      .select("ean");
    if (upErr) return { ok: false, error: upErr.message };
    // Ligne absente (rare) : on la crée alors entièrement depuis la soumission.
    if (!updated || updated.length === 0) {
      const { error: insErr } = await sb
        .schema("cosme_check")
        .from("catalog")
        .insert({
          ean: submission.ean,
          brand: submission.brand,
          name: submission.name,
          category: submission.category,
          image_url: imageUrl,
          is_active: true,
        });
      if (insErr) return { ok: false, error: insErr.message };
    }
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

// ── Contribution scan : OCR de la photo ingrédients + publication au catalogue ──

export type OcrActionResult =
  | { ok: true; inci: string; name: string | null; brand: string | null }
  | { ok: false; error: string };

/**
 * Lance l'OCR (edge admin-ocr-submission) sur la photo « ingrédients » d'une
 * contribution : réutilise le moteur OCR du scan mobile (gpt-4o-mini vision) +
 * lit la marque/nom sur le devant. Persiste extracted_inci/name/brand. L'admin
 * relit/corrige avant de publier.
 */
export async function ocrSubmission(submissionId: string): Promise<OcrActionResult> {
  await requireAdmin();
  if (!submissionId) return { ok: false, error: "Identifiant manquant." };
  const sb = supabaseAdmin();
  try {
    const { data, error } = await sb.functions.invoke("admin-ocr-submission", {
      body: { submissionId },
    });
    if (error) return { ok: false, error: error.message ?? "Échec de l'OCR." };
    const d = (data ?? {}) as { ok?: boolean; inci?: string; name?: string | null; brand?: string | null; reason?: string };
    if (!d.ok) return { ok: false, error: d.reason ?? "OCR sans résultat lisible." };
    revalidatePath("/feedback/products");
    return { ok: true, inci: d.inci ?? "", name: d.name ?? null, brand: d.brand ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur OCR." };
  }
}

export type PublishInput = {
  submissionId: string;
  ean: string;
  name: string;
  brand: string;
  inci: string;
  category: string;
  imagePath: string;
};
export type PublishResult = { ok: true; score: number; scoreLabel: string } | { ok: false; error: string };

/**
 * Publie une contribution au catalogue : note l'INCI (relu par l'admin) via
 * l'edge admin-score-upsert (moteur V2 identique au reste du catalogue), avec la
 * photo devant comme image. search_norm/search_key sont des colonnes GÉNÉRÉES →
 * le produit est immédiatement recherchable. La soumission passe à 'approved'.
 */
export async function publishSubmission(input: PublishInput): Promise<PublishResult> {
  const admin = await requireAdmin();
  const ean = input.ean?.trim();
  const inci = input.inci?.trim();
  if (!ean) return { ok: false, error: "EAN manquant." };
  if (!inci || inci.length < 20) {
    return { ok: false, error: "Liste d'ingrédients trop courte — relis la photo ou corrige-la." };
  }
  const sb = supabaseAdmin();
  const imageUrl = input.imagePath
    ? sb.storage.from(BUCKET).getPublicUrl(input.imagePath).data.publicUrl
    : null;
  try {
    const { data, error } = await sb.functions.invoke("admin-score-upsert", {
      body: {
        ean,
        name: input.name?.trim() || null,
        brand: input.brand?.trim() || null,
        inci,
        category: input.category?.trim() || null,
        image_url: imageUrl,
      },
    });
    if (error) return { ok: false, error: error.message ?? "Échec de la publication." };
    const d = (data ?? {}) as { ok?: boolean; reason?: string; score?: number; scoreLabel?: string };
    if (!d.ok) return { ok: false, error: d.reason ?? "Échec de la notation." };

    await sb
      .schema("cosme_check")
      .from("catalog_photo_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
      .eq("id", input.submissionId);

    await logAudit({
      adminEmail: admin.email,
      action: "product_photo.publish",
      payload: { submission_id: input.submissionId, ean, score: d.score },
    });

    revalidatePath("/feedback/products");
    return { ok: true, score: d.score ?? 0, scoreLabel: d.scoreLabel ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur de publication." };
  }
}
