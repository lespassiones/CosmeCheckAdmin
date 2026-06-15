/**
 * Helpers purs sur les chemins de catégorie (« famille/sous/feuille »).
 *
 * AUCUN import server-only ici : ce module est importé par des Client Components
 * (ex. WebProductCard, filtres catalogue). Garder server-only hors d'ici.
 */
export type WebProductStatus = "pending" | "resolved" | "rejected";

export type WebProductRow = {
  id: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  ingredients_text: string | null;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  occurrences: number;
  status: WebProductStatus;
  found_ean: string | null;
  created_at: string;
  updated_at: string;
};

export type WebProductsKpis = {
  pending: number;
  resolved: number;
  categories: number;
};

function humanizeSegment(seg: string): string {
  const s = seg.replace(/-/g, " ").trim();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : seg;
}

/** Famille (1er segment du chemin catégorie) → libellé humain. */
export function familyOf(category: string | null): string {
  if (!category) return "Sans catégorie";
  return humanizeSegment(category.split("/")[0]);
}

/** Feuille (dernier segment) → libellé humain, pour l'affichage de la sous-catégorie. */
export function leafOf(category: string | null): string {
  if (!category) return "";
  const parts = category.split("/").filter(Boolean);
  return humanizeSegment(parts[parts.length - 1] ?? "");
}
