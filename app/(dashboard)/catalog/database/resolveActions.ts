"use server";

import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";

export type ResolveResult =
  | { ok: true; ean: string; name: string | null; brand: string | null; score: number; scoreLabel: string; category: string | null; countOrange: number; countRouge: number }
  | { ok: false; ean: string; reason: string };

/**
 * Résout UN produit « code-barre seul » via l'Edge `admin-resolve-barcode`
 * (OBF + GPT → nom/marque/INCI/catégorie → note + blocus → upsert catalogue).
 * Appelée en boucle (concurrence limitée) par le panneau de résolution.
 */
export async function resolveBarcode(ean: string): Promise<ResolveResult> {
  await requireAdmin();
  const sb = supabaseAdmin();
  try {
    const { data, error } = await sb.functions.invoke("admin-resolve-barcode", { body: { ean } });
    if (error) return { ok: false, ean, reason: error.message ?? "Échec Edge" };
    return (data as ResolveResult) ?? { ok: false, ean, reason: "Réponse vide" };
  } catch (e) {
    return { ok: false, ean, reason: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
