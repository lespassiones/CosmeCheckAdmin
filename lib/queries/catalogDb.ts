/**
 * Vraie base produits de l'app mobile : `cosme_check.catalog` (~405k lignes).
 * NB : l'ancienne page /catalog/products lit `cosme_check.products` (33k, scrape
 * INCI Beauty) — ce module-ci cible la base réellement servie au mobile.
 *
 * Server-only, supabaseAdmin (service_role).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type CatalogStats = {
  total: number;
  with_photo: number;
  without_photo: number;
  with_score: number;
  without_score: number;
  with_inci: number;
  without_inci: number;
  source_web: number;
  source_incibeauty: number;
  penalizing: number;
  active: number;
  inactive: number;
  real_ean: number;
  synthetic_ean: number;
};

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const sb = supabaseAdmin();
  const { data } = await sb.rpc("cosme_check_catalog_admin_stats");
  return (data as CatalogStats) ?? ({} as CatalogStats);
}

export type CatalogProductRow = {
  ean: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  score: number | null;
  score_label: string | null;
  score_tone: string | null;
  count_total: number | null;
  has_penalizing: boolean | null;
  is_active: boolean | null;
  count_orange: number | null;
  count_rouge: number | null;
};

export type CatalogFilters = {
  q?: string;
  photo?: "with" | "without";
  score?: "with" | "without";
  inci?: "with" | "without";
  /** Provenance du score : web/notre analyse (source_url présent) vs INCI Beauty. */
  source?: "web" | "incibeauty";
  penalizing?: "with" | "without";
  active?: "active" | "inactive";
  category?: string;
  page?: number;
  size?: number;
};

export type CatalogListResult = {
  rows: CatalogProductRow[];
  page: number;
  size: number;
  hasMore: boolean;
};

const COLS =
  "ean, brand, name, category, image_url, source_url, score, score_label, score_tone, count_total, has_penalizing, is_active, count_orange, count_rouge";

export async function listCatalogProducts(f: CatalogFilters): Promise<CatalogListResult> {
  const sb = supabaseAdmin();
  const page = Math.max(1, f.page ?? 1);
  const size = Math.min(100, Math.max(10, f.size ?? 50));
  const from = (page - 1) * size;
  // +1 pour savoir s'il reste une page.
  const to = from + size;

  let q = sb.schema("cosme_check").from("catalog").select(COLS);

  if (f.q && f.q.trim().length >= 2) {
    const term = f.q.trim().replace(/[%,]/g, " ");
    q = q.or(`brand.ilike.%${term}%,name.ilike.%${term}%`);
  }
  if (f.photo === "with") q = q.not("image_url", "is", null);
  if (f.photo === "without") q = q.is("image_url", null);
  if (f.score === "with") q = q.not("score", "is", null);
  if (f.score === "without") q = q.is("score", null);
  if (f.inci === "with") q = q.not("ingredients_text", "is", null);
  if (f.inci === "without") q = q.is("ingredients_text", null);
  if (f.source === "web") q = q.not("source_url", "is", null);
  if (f.source === "incibeauty") q = q.is("source_url", null);
  if (f.penalizing === "with") q = q.eq("has_penalizing", true);
  if (f.penalizing === "without") q = q.or("has_penalizing.is.null,has_penalizing.eq.false");
  if (f.active === "active") q = q.eq("is_active", true);
  if (f.active === "inactive") q = q.or("is_active.is.null,is_active.eq.false");
  if (f.category && f.category.trim()) q = q.ilike("category", `%${f.category.trim()}%`);

  q = q.order("score", { ascending: false, nullsFirst: false }).order("ean", { ascending: true }).range(from, to);

  const { data } = await q;
  const all = (data as CatalogProductRow[] | null) ?? [];
  const hasMore = all.length > size;
  return { rows: all.slice(0, size), page, size, hasMore };
}

export type CatalogProductDetail = {
  product: CatalogProductRow & { ingredients_text: string | null };
  /** result_json de l'analyse cachée, SANS la synthèse (réservée au mobile). */
  analysis: Record<string, unknown> | null;
  hasPromise: boolean;
};

export async function fetchCatalogProduct(ean: string): Promise<CatalogProductDetail | null> {
  const sb = supabaseAdmin();
  const { data: prod } = await sb
    .schema("cosme_check")
    .from("catalog")
    .select(`${COLS}, ingredients_text`)
    .eq("ean", ean)
    .single();
  if (!prod) return null;

  const { data: pa } = await sb
    .schema("cosme_check")
    .from("product_analyses")
    .select("result_json")
    .eq("ean", ean)
    .maybeSingle();

  let analysis = (pa as { result_json: Record<string, unknown> } | null)?.result_json ?? null;
  if (analysis && typeof analysis === "object") {
    // On retire la synthèse : elle est personnalisée/réservée au mobile.
    const { synthesis: _omit, ...rest } = analysis as Record<string, unknown>;
    analysis = rest;
  }

  // Promesse analysée pour ce produit ? coherence_analyses est keyé par
  // analysis_id → on remonte aux analyses de ce produit (par EAN).
  let hasPromise = false;
  const { data: ax } = await sb
    .schema("cosme_check")
    .from("analyses")
    .select("id")
    .eq("ean", ean)
    .limit(100);
  const ids = ((ax as { id: string }[] | null) ?? []).map((r) => r.id);
  if (ids.length) {
    const { count } = await sb
      .schema("cosme_check")
      .from("coherence_analyses")
      .select("id", { count: "exact", head: true })
      .in("analysis_id", ids);
    hasPromise = (count ?? 0) > 0;
  }

  return {
    product: prod as CatalogProductRow & { ingredients_text: string | null },
    analysis,
    hasPromise,
  };
}
