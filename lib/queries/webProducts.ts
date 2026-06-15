/**
 * Web products queue — read helpers for the /catalog/web-products admin page.
 *
 * `cosme_check.web_products` holds products found on the internet that have NO
 * EAN yet → they're absent from the main catalogue. The mobile app's `analyser`
 * Edge function enqueues them (after OBF + GPT auto-resolution failed). The admin
 * resolves the EAN (GPT web search) and promotes them into `catalog`.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { familyOf, type WebProductRow, type WebProductsKpis } from "@/lib/categoryPath";

// Ré-export pour les modules serveur qui importaient depuis ici.
export { familyOf, leafOf } from "@/lib/categoryPath";
export type { WebProductRow, WebProductsKpis } from "@/lib/categoryPath";

export async function fetchWebProductsKpis(): Promise<WebProductsKpis> {
  const sb = supabaseAdmin();
  const [pendRes, resolvedRes, catRes] = await Promise.all([
    sb.schema("cosme_check").from("web_products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.schema("cosme_check").from("web_products").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    sb.schema("cosme_check").from("web_products").select("category").eq("status", "pending").limit(1000),
  ]);
  const cats = new Set(
    ((catRes.data as { category: string | null }[] | null) ?? []).map((r) => familyOf(r.category)),
  );
  return {
    pending: pendRes.count ?? 0,
    resolved: resolvedRes.count ?? 0,
    categories: cats.size,
  };
}

/**
 * Produits en attente, triés par catégorie puis fréquence (occurrences). Borné
 * à 500 — la file ne doit pas exploser (l'auto-résolution traite la majorité).
 */
export async function listPendingWebProducts(): Promise<WebProductRow[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .schema("cosme_check")
    .from("web_products")
    .select("*")
    .eq("status", "pending")
    .order("category", { ascending: true, nullsFirst: false })
    .order("occurrences", { ascending: false })
    .limit(500);
  return (data as WebProductRow[] | null) ?? [];
}

/** Groupe une liste de produits par famille (1er segment de catégorie). */
export function groupByFamily(rows: WebProductRow[]): { family: string; items: WebProductRow[] }[] {
  const map = new Map<string, WebProductRow[]>();
  for (const r of rows) {
    const fam = familyOf(r.category);
    const arr = map.get(fam) ?? [];
    arr.push(r);
    map.set(fam, arr);
  }
  return [...map.entries()]
    .map(([family, items]) => ({ family, items }))
    .sort((a, b) => b.items.length - a.items.length);
}
