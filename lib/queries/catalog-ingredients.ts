/**
 * Catalogue ingredients — read helpers for the /catalog/ingredients page.
 *
 * The `cosme_check.ingredients` table holds ~15 k rows from the INCI database.
 * We display them alongside AI-generated explanations stored in
 * `cosme_check.ingredient_explanations` (one row per ingredient).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type IngredientView = "all" | "missing_expl" | "missing_details";

export type IngredientRow = {
  id: number;
  inci_id: number;
  slug: string | null;
  name: string | null;
  cas_number: string | null;
  color_rating: "Vert" | "Jaune" | "Orange" | "Rouge" | null;
  functions: unknown;
  prevalence_pct: number | null;
  source_url: string | null;
  details_scraped: boolean | null;
  has_explanation: boolean;
};

export type IngredientsKpis = {
  total: number;
  withExplanation: number;
  withoutExplanation: number;
  detailsScraped: number;
  byColor: { Vert: number; Jaune: number; Orange: number; Rouge: number };
};

export async function fetchIngredientsKpis(): Promise<IngredientsKpis> {
  const sb = supabaseAdmin();

  const [totalRes, detailsRes, explRes, colorRes] = await Promise.all([
    sb.schema("cosme_check").from("ingredients").select("id", { count: "exact", head: true }),
    sb
      .schema("cosme_check")
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .eq("details_scraped", true),
    sb.schema("cosme_check").from("ingredient_explanations").select("inci_id", { count: "exact", head: true }),
    sb.schema("cosme_check").from("ingredients").select("color_rating"),
  ]);

  const total = totalRes.count ?? 0;
  const withExplanation = explRes.count ?? 0;

  const byColor = { Vert: 0, Jaune: 0, Orange: 0, Rouge: 0 };
  for (const r of (colorRes.data ?? []) as { color_rating: string | null }[]) {
    if (r.color_rating && r.color_rating in byColor) {
      byColor[r.color_rating as keyof typeof byColor] += 1;
    }
  }

  return {
    total,
    withExplanation,
    withoutExplanation: Math.max(0, total - withExplanation),
    detailsScraped: detailsRes.count ?? 0,
    byColor,
  };
}

export type ListIngredientsOpts = {
  search?: string;
  view?: IngredientView;
  limit?: number;
};

export async function listIngredients(opts: ListIngredientsOpts): Promise<IngredientRow[]> {
  const sb = supabaseAdmin();
  const limit = Math.min(500, Math.max(10, opts.limit ?? 200));
  const search = (opts.search ?? "").trim();
  const view: IngredientView = opts.view ?? "all";

  // 1. Pull the set of inci_ids that DO have an explanation. We need this
  //    for the "Sans explication AI" filter AND for the has_explanation flag
  //    in the table rendering. ~15 k ints is a few hundred KB — cheap.
  const explIds = new Set<number>();
  let from = 0;
  const STEP = 5000;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await sb
      .schema("cosme_check")
      .from("ingredient_explanations")
      .select("inci_id")
      .range(from, from + STEP - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as { inci_id: number }[]) explIds.add(r.inci_id);
    if (data.length < STEP) break;
    from += STEP;
  }

  // 2. Main query on ingredients.
  let query = sb
    .schema("cosme_check")
    .from("ingredients")
    .select(
      "id, inci_id, slug, name, cas_number, color_rating, functions, prevalence_pct, source_url, details_scraped",
    );

  if (search) {
    const needle = `%${search.replace(/[%_]/g, "")}%`;
    query = query.or(`name.ilike.${needle},slug.ilike.${needle}`);
  }

  if (view === "missing_details") {
    query = query.eq("details_scraped", false);
  }
  if (view === "missing_expl") {
    if (explIds.size > 0) {
      // PostgREST "not.in" wants a parenthesised list. Cap at the first N
      // values to keep the URL reasonable — we then re-filter client-side.
      const slice = Array.from(explIds).slice(0, 4000);
      query = query.not("inci_id", "in", `(${slice.join(",")})`);
    }
  }

  query = query.order("prevalence_pct", { ascending: false, nullsFirst: false });

  const { data, error } = await query.limit(limit * 2); // overfetch a bit for client-side filter
  if (error || !data) return [];

  let rows = (data as Omit<IngredientRow, "has_explanation">[]).map((r) => ({
    ...r,
    has_explanation: explIds.has(r.inci_id),
  })) as IngredientRow[];

  // Belt-and-suspenders client filter for the explanation view, in case the
  // .not.in slice was truncated.
  if (view === "missing_expl") {
    rows = rows.filter((r) => !r.has_explanation);
  }

  return rows.slice(0, limit);
}

/** Extract the first function name from the messy `functions` jsonb shape. */
export function primaryFunction(functions: unknown): string | null {
  if (!functions) return null;
  if (Array.isArray(functions)) {
    const first = functions[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      // common shapes: { name } or { label } or { fr }
      const obj = first as Record<string, unknown>;
      for (const key of ["name", "label", "fr", "en"]) {
        const v = obj[key];
        if (typeof v === "string") return v;
      }
    }
  }
  if (typeof functions === "object") {
    const obj = functions as Record<string, unknown>;
    for (const key of ["fr", "name", "label", "primary"]) {
      const v = obj[key];
      if (typeof v === "string") return v;
    }
  }
  return null;
}
