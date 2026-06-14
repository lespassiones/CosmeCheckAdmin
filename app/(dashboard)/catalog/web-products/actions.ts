"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { findEanByWebSearch, isValidGtin } from "@/lib/eanWebSearch";
import type { WebProductRow } from "@/lib/queries/webProducts";

export type FindResult =
  | { ok: true; ean: string }
  | { ok: false; error: string };

const PAGE = "/catalog/web-products";

async function loadPending(id: string): Promise<WebProductRow | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .schema("cosme_check")
    .from("web_products")
    .select("*")
    .eq("id", id)
    .single();
  const row = data as WebProductRow | null;
  return row && row.status === "pending" ? row : null;
}

/**
 * Promeut un produit web dans le catalogue avec l'EAN donné, puis marque la
 * ligne `web_products` comme résolue. Upsert via la RPC catalogue (11 args) :
 * catégorie + INCI + source conservés, score null (rempli par la passe de
 * scoring du catalogue, comme les autres produits internet).
 */
async function promote(row: WebProductRow, ean: string, sourceUrl: string | null): Promise<void> {
  const sb = supabaseAdmin();
  await sb.rpc("cosme_check_upsert_catalog_product", {
    p_ean: ean,
    p_brand: row.brand,
    p_name: row.name,
    p_ingredients_text: row.ingredients_text,
    p_source_url: sourceUrl ?? row.source_url,
    p_category: row.category,
    p_score: null,
    p_score_label: null,
    p_score_tone: null,
    p_count_total: null,
    p_image_url: row.image_url,
  });
  await sb
    .schema("cosme_check")
    .from("web_products")
    .update({
      status: "resolved",
      found_ean: ean,
      source_url: sourceUrl ?? row.source_url,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
}

/** Cherche l'EAN via GPT web-search ; si trouvé → promotion automatique. */
export async function findAndPromote(id: string): Promise<FindResult> {
  await requireAdmin();
  const row = await loadPending(id);
  if (!row) return { ok: false, error: "Produit introuvable ou déjà traité." };

  const found = await findEanByWebSearch(row.brand, row.name);
  if (!found) {
    return { ok: false, error: "Aucun EAN fiable trouvé. Essaie une saisie manuelle." };
  }
  try {
    await promote(row, found.ean, found.sourceUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de l'enregistrement." };
  }
  revalidatePath(PAGE);
  return { ok: true, ean: found.ean };
}

/** Promotion manuelle avec un EAN saisi par l'admin (validé par checksum). */
export async function promoteWithEan(id: string, rawEan: string): Promise<FindResult> {
  await requireAdmin();
  const ean = (rawEan ?? "").replace(/\D/g, "");
  if (!isValidGtin(ean)) {
    return { ok: false, error: "Code-barres invalide (clé de contrôle EAN incorrecte)." };
  }
  const row = await loadPending(id);
  if (!row) return { ok: false, error: "Produit introuvable ou déjà traité." };
  try {
    await promote(row, ean, null);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de l'enregistrement." };
  }
  revalidatePath(PAGE);
  return { ok: true, ean };
}

export type RejectResult = { ok: true } | { ok: false; error: string };

/** Écarte un produit de la file (faux produit, non identifiable). */
export async function rejectWebProduct(id: string): Promise<RejectResult> {
  await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("web_products")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}
