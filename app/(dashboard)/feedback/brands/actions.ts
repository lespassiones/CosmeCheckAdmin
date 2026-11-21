"use server";

/**
 * Décisions sur les fiches de l'espace marques. Tout se passe ICI, en interne :
 * le site ne fait que recevoir les fiches.
 *
 *   previewBrandScore  : calcule la note (aucune écriture) et dit si le produit
 *                        est déjà au catalogue.
 *   approveBrand       : met le produit dans l'app (admin-score-upsert, même
 *                        moteur que tout le catalogue) puis prévient la marque.
 *   rejectBrand        : refuse, avec un message facultatif à la marque.
 *   saveCheckNote      : note de vérification interne.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { parseInciList, pastilleTone, sameInci, scoreLabel, starsFor, synthScore, type ColorRating, type StarCount } from "@/lib/brands/scoring";
import { approvedEmail, rejectedEmail, sendBrandMail } from "@/lib/brands/mail";

const BUCKET = "cosmetwiki-products";
const PAGE = "/feedback/brands";

export type Preview =
  | {
      ok: true;
      catalogEan: string;
      /** Note de la composition envoyée par la marque. */
      computed: { score: number; label: string; stars: StarCount; identPct: number; nVert: number; nJaune: number; nOrange: number; nRouge: number } | null;
      /** < 50 % d'ingrédients reconnus : la composition ne peut pas être notée. */
      unreadable: boolean;
      /** Le produit est déjà noté dans l'app : c'est CETTE note qui sera gardée. */
      existing: { name: string | null; brand: string | null; score: number; stars: StarCount; sameComposition: boolean } | null;
    }
  | { ok: false; error: string };

type Sub = {
  id: string;
  status: string;
  brand: string;
  product_name: string;
  ean: string | null;
  contact_name: string | null;
  contact_email: string;
  product_url: string | null;
  photo_front_path: string | null;
};

async function loadSub(id: string): Promise<Sub | null> {
  const { data } = await supabaseAdmin()
    .schema("cosme_check")
    .from("brand_product_submissions")
    .select("id, status, brand, product_name, ean, contact_name, contact_email, product_url, photo_front_path")
    .eq("id", id)
    .maybeSingle();
  return (data as Sub | null) ?? null;
}

function catalogKey(sub: Sub, ean?: string): string {
  const e = (ean ?? sub.ean ?? "").replace(/\D/g, "");
  return e || `cc-brand-${sub.id}`;
}

async function readCatalog(ean: string) {
  const { data } = await supabaseAdmin()
    .schema("cosme_check")
    .from("catalog")
    .select("ean, brand, name, score, count_orange, count_rouge, ingredients_text, image_url")
    .eq("ean", ean)
    .maybeSingle();
  return data as {
    ean: string;
    brand: string | null;
    name: string | null;
    score: number | null;
    count_orange: number | null;
    count_rouge: number | null;
    ingredients_text: string | null;
    image_url: string | null;
  } | null;
}

export async function previewBrandScore(input: { id: string; inci: string; ean?: string }): Promise<Preview> {
  await requireAdmin();
  const sub = await loadSub(input.id);
  if (!sub) return { ok: false, error: "Fiche introuvable." };
  const tokens = parseInciList(input.inci);
  if (tokens.length === 0) return { ok: false, error: "Composition illisible." };

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_match_inci_batch", { p_tokens: tokens.map((t) => t.normalized) });
  if (error) return { ok: false, error: "Lecture des ingrédients impossible." };
  const matches = ((data ?? []) as { color_rating: ColorRating | null; position_idx: number }[]).map((r) => ({
    color: r.color_rating,
    position: (r.position_idx ?? 0) + 1,
  }));
  const p = pastilleTone(matches, tokens.length, true);
  const score = synthScore(p);
  const identPct = Math.round((100 * p.nIdent) / tokens.length);

  const catalogEan = catalogKey(sub, input.ean);
  const row = await readCatalog(catalogEan);
  const existingStars = row ? starsFor(row.score, row.count_orange ?? 0, row.count_rouge ?? 0) : null;

  return {
    ok: true,
    catalogEan,
    unreadable: score == null,
    computed:
      score == null
        ? null
        : {
            score,
            label: scoreLabel(score),
            stars: starsFor(score, p.nOrange, p.nRouge)!,
            identPct,
            nVert: p.nVert,
            nJaune: p.nJaune,
            nOrange: p.nOrange,
            nRouge: p.nRouge,
          },
    existing:
      row && row.score != null && existingStars
        ? { name: row.name, brand: row.brand, score: row.score, stars: existingStars, sameComposition: sameInci(row.ingredients_text, input.inci) }
        : null,
  };
}

export type ApproveResult = { ok: true; stars: StarCount; notified: boolean; keptExisting: boolean } | { ok: false; error: string };

export async function approveBrand(input: {
  id: string;
  inci: string;
  productName: string;
  brand: string;
  ean?: string;
  category?: string;
}): Promise<ApproveResult> {
  const admin = await requireAdmin();
  const sub = await loadSub(input.id);
  if (!sub) return { ok: false, error: "Fiche introuvable." };
  const sb = supabaseAdmin();
  const catalogEan = catalogKey(sub, input.ean);
  const imageUrl = sub.photo_front_path ? sb.storage.from(BUCKET).getPublicUrl(sub.photo_front_path).data.publicUrl : null;

  const before = await readCatalog(catalogEan);
  const keptExisting = before?.score != null;

  if (!keptExisting) {
    // Produit nouveau (ou sans note) : même moteur que tout le catalogue.
    const { data, error } = await sb.functions.invoke("admin-score-upsert", {
      body: {
        ean: catalogEan,
        name: input.productName.trim() || sub.product_name,
        brand: input.brand.trim() || sub.brand,
        inci: input.inci.trim(),
        category: input.category?.trim() || null,
        image_url: imageUrl,
        source_url: sub.product_url,
      },
    });
    if (error) return { ok: false, error: error.message ?? "Publication impossible." };
    const d = (data ?? {}) as { ok?: boolean; reason?: string };
    if (!d.ok) return { ok: false, error: d.reason ?? "Note impossible." };
  } else if (!before?.image_url && imageUrl) {
    // Déjà noté : on garde la note (règle « note unique »), on ajoute juste la photo.
    await sb.schema("cosme_check").from("catalog").update({ image_url: imageUrl }).eq("ean", catalogEan);
  }

  const row = await readCatalog(catalogEan);
  const stars = row ? starsFor(row.score, row.count_orange ?? 0, row.count_rouge ?? 0) : null;
  if (!row || !stars) return { ok: false, error: "Produit introuvable au catalogue après publication." };

  const notified = await sendBrandMail(
    { email: sub.contact_email, name: sub.contact_name },
    approvedEmail({ contactName: sub.contact_name, brand: row.brand ?? sub.brand, productName: row.name ?? sub.product_name, stars, ean: catalogEan }),
    "marques-reference",
  );

  await sb
    .schema("cosme_check")
    .from("brand_product_submissions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewer_email: admin.email,
      catalog_ean: catalogEan,
      score: row.score,
      score_label: row.score != null ? scoreLabel(row.score) : null,
      stars,
      notified_at: notified ? new Date().toISOString() : null,
    })
    .eq("id", sub.id);

  await logAudit({ adminEmail: admin.email, action: "brand.approve", payload: { id: sub.id, ean: catalogEan, stars, notified, keptExisting } });
  revalidatePath(PAGE);
  return { ok: true, stars, notified, keptExisting };
}

export async function rejectBrand(input: { id: string; reason: string }): Promise<{ ok: true; notified: boolean } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const sub = await loadSub(input.id);
  if (!sub) return { ok: false, error: "Fiche introuvable." };
  const reason = input.reason.trim().slice(0, 2000);
  const notified = reason
    ? await sendBrandMail(
        { email: sub.contact_email, name: sub.contact_name },
        rejectedEmail({ contactName: sub.contact_name, productName: sub.product_name, reason }),
        "marques-refus",
      )
    : false;
  await supabaseAdmin()
    .schema("cosme_check")
    .from("brand_product_submissions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewer_email: admin.email,
      review_note: reason || null,
      notified_at: notified ? new Date().toISOString() : null,
    })
    .eq("id", sub.id);
  await logAudit({ adminEmail: admin.email, action: "brand.reject", payload: { id: sub.id, notified } });
  revalidatePath(PAGE);
  return { ok: true, notified };
}

export async function reopenBrand(id: string): Promise<{ ok: boolean }> {
  const admin = await requireAdmin();
  await supabaseAdmin()
    .schema("cosme_check")
    .from("brand_product_submissions")
    .update({ status: "pending", reviewed_at: null })
    .eq("id", id);
  await logAudit({ adminEmail: admin.email, action: "brand.reopen", payload: { id } });
  revalidatePath(PAGE);
  return { ok: true };
}

export async function saveCheckNote(input: { id: string; note: string }): Promise<{ ok: boolean }> {
  await requireAdmin();
  await supabaseAdmin()
    .schema("cosme_check")
    .from("brand_product_submissions")
    .update({ check_note: input.note.trim().slice(0, 4000) || null })
    .eq("id", input.id);
  revalidatePath(PAGE);
  return { ok: true };
}
