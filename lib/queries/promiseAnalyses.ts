/**
 * Analyses de promesse (cohérence) — vue admin : quels produits ont eu une
 * analyse « Analyser la promesse ». Source : cosme_check.coherence_analyses
 * (un enregistrement par user/analyse) enrichi du produit via analyses.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type PromiseAnalysisRow = {
  id: string;
  analysis_id: string | null;
  product_name: string | null;
  brand: string | null;
  ean: string | null;
  description: string | null;
  /** % de promesses tenues (metrics.tenuePct) — le verdict montré à l'user. */
  tenuePct: number | null;
  tenueCount: number | null;
  totalPromises: number | null;
  /** Texte de conclusion (verdict détaillé). */
  conclusion: string | null;
  created_at: string;
};

type Metrics = { tenuePct?: number; tenueCount?: number; totalPromises?: number };

function metricsOf(rj: unknown): Metrics {
  if (!rj || typeof rj !== "object") return {};
  const m = (rj as Record<string, unknown>).metrics;
  return (m && typeof m === "object" ? (m as Metrics) : {}) ?? {};
}
function conclusionOf(rj: unknown): string | null {
  if (!rj || typeof rj !== "object") return null;
  const c = (rj as Record<string, unknown>).conclusion;
  return typeof c === "string" ? c : null;
}

export async function fetchPromiseStats(): Promise<{ total: number; products: number }> {
  const sb = supabaseAdmin();
  const [{ count }, cacheRes] = await Promise.all([
    sb.schema("cosme_check").from("coherence_analyses").select("id", { count: "exact", head: true }),
    sb.schema("cosme_check").from("coherence_cache").select("inci_hash", { count: "exact", head: true }),
  ]);
  return { total: count ?? 0, products: cacheRes.count ?? 0 };
}

export async function listPromiseAnalyses(limit = 100): Promise<PromiseAnalysisRow[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .schema("cosme_check")
    .from("coherence_analyses")
    .select("id, analysis_id, description, result_json, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 300));

  const rows = (data as { id: string; analysis_id: string | null; description: string | null; result_json: unknown; created_at: string }[] | null) ?? [];
  const ids = rows.map((r) => r.analysis_id).filter((x): x is string => !!x);

  const byId = new Map<string, { name: string | null; product_label: string | null; brand: string | null; ean: string | null }>();
  if (ids.length) {
    const { data: ax } = await sb
      .schema("cosme_check")
      .from("analyses")
      .select("id, name, product_label, brand, ean")
      .in("id", ids);
    for (const a of (ax as { id: string; name: string | null; product_label: string | null; brand: string | null; ean: string | null }[] | null) ?? []) {
      byId.set(a.id, a);
    }
  }

  return rows.map((r) => {
    const a = r.analysis_id ? byId.get(r.analysis_id) : undefined;
    return {
      id: r.id,
      analysis_id: r.analysis_id,
      product_name: a?.product_label ?? a?.name ?? null,
      brand: a?.brand ?? null,
      ean: a?.ean ?? null,
      description: r.description,
      tenuePct: typeof metricsOf(r.result_json).tenuePct === "number" ? metricsOf(r.result_json).tenuePct! : null,
      tenueCount: typeof metricsOf(r.result_json).tenueCount === "number" ? metricsOf(r.result_json).tenueCount! : null,
      totalPromises: typeof metricsOf(r.result_json).totalPromises === "number" ? metricsOf(r.result_json).totalPromises! : null,
      conclusion: conclusionOf(r.result_json),
      created_at: r.created_at,
    };
  });
}
