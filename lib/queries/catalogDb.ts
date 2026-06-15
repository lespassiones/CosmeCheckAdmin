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
  only_barcode: number;
};

const ZERO_STATS: CatalogStats = {
  total: 0, with_photo: 0, without_photo: 0, with_score: 0, without_score: 0,
  with_inci: 0, without_inci: 0, source_web: 0, source_incibeauty: 0,
  penalizing: 0, active: 0, inactive: 0, real_ean: 0, synthetic_ean: 0, only_barcode: 0,
};

/**
 * Stats = LECTURE INSTANTANÉE d'une ligne précalculée (cosme_check.catalog_stats_cache),
 * rafraîchie par un cron horaire. Le scan ~10s ne tourne JAMAIS dans la requête
 * admin → pas de timeout Vercel, pas d'écran à « 0 ».
 */
export async function fetchCatalogStats(): Promise<CatalogStats> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_get_catalog_stats");
  if (error || !data) return ZERO_STATS;
  return { ...ZERO_STATS, ...(data as Partial<CatalogStats>) };
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
  /** Produits « code-barre seul » (stubs : pas de marque/INCI/photo). */
  onlyBarcode?: boolean;
  category?: string;
  page?: number;
  size?: number;
};

export type CatalogListResult = {
  rows: CatalogProductRow[];
  page: number;
  size: number;
  hasMore: boolean;
  /** True si la recherche a échoué/timeout (≥10s) → on l'affiche à l'admin. */
  timedOut: boolean;
};

/**
 * Liste filtrée via la RPC indexée `cosme_check_admin_catalog_search` : recherche
 * texte servie par l'index GIN trigram (pas de seq-scan), statement_timeout 10s
 * côté DB → ne sature jamais la base. On demande size+1 lignes pour savoir s'il
 * reste une page.
 */
export async function listCatalogProducts(f: CatalogFilters): Promise<CatalogListResult> {
  const sb = supabaseAdmin();
  const page = Math.max(1, f.page ?? 1);
  const size = Math.min(100, Math.max(10, f.size ?? 50));
  const offset = (page - 1) * size;

  const { data, error } = await sb.rpc("cosme_check_admin_catalog_search", {
    p_q: f.q ?? null,
    p_photo: f.photo ?? null,
    p_score: f.score ?? null,
    p_inci: f.inci ?? null,
    p_source: f.source ?? null,
    p_penalizing: f.penalizing ?? null,
    p_active: f.active ?? null,
    p_only_barcode: f.onlyBarcode ?? false,
    p_category: f.category ?? null,
    p_limit: size + 1,
    p_offset: offset,
  });

  if (error) {
    // statement_timeout (57014) ou autre → on n'écroule pas la page.
    return { rows: [], page, size, hasMore: false, timedOut: true };
  }
  const all = (data as CatalogProductRow[] | null) ?? [];
  const hasMore = all.length > size;
  return { rows: all.slice(0, size), page, size, hasMore, timedOut: false };
}

const COLS =
  "ean, brand, name, category, image_url, source_url, score, score_label, score_tone, count_total, has_penalizing, is_active, count_orange, count_rouge";

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
