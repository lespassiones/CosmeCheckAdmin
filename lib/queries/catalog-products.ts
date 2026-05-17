/**
 * Catalogue products — read helpers for the /catalog/products admin page.
 *
 * The `cosme_check.products` table holds ~33 k rows scraped from the INCI
 * Beauty database. We never paginate over the whole thing — every query
 * is bounded and runs against an indexed column (id desc, brand, name).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type ProductRow = {
  id: number;
  inci_product_id: string | null;
  brand: string | null;
  name: string | null;
  volume: string | null;
  score: number | null;
  image_url: string | null;
  source_url: string | null;
  scraped_at: string | null;
};

export type ProductsKpis = {
  total: number;
  withImage: number;
  withScore: number;
  scrapedLast30d: number;
};

export async function fetchProductsKpis(): Promise<ProductsKpis> {
  const sb = supabaseAdmin();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [totalRes, imgRes, scoreRes, recentRes] = await Promise.all([
    sb.schema("cosme_check").from("products").select("id", { count: "exact", head: true }),
    sb
      .schema("cosme_check")
      .from("products")
      .select("id", { count: "exact", head: true })
      .not("image_url", "is", null),
    sb
      .schema("cosme_check")
      .from("products")
      .select("id", { count: "exact", head: true })
      .not("score", "is", null),
    sb
      .schema("cosme_check")
      .from("products")
      .select("id", { count: "exact", head: true })
      .gte("scraped_at", since30),
  ]);

  return {
    total: totalRes.count ?? 0,
    withImage: imgRes.count ?? 0,
    withScore: scoreRes.count ?? 0,
    scrapedLast30d: recentRes.count ?? 0,
  };
}

export type ListProductsOpts = {
  search?: string;
  page?: number;
  size?: number;
  /** If true, only return products without any row in product_ingredients. */
  missingInci?: boolean;
};

export type ListProductsResult = {
  rows: ProductRow[];
  total: number;
  page: number;
  size: number;
  hasNext: boolean;
};

export async function listProducts(opts: ListProductsOpts): Promise<ListProductsResult> {
  const sb = supabaseAdmin();
  const size = Math.min(200, Math.max(10, opts.size ?? 50));
  const page = Math.max(1, opts.page ?? 1);
  const search = (opts.search ?? "").trim();

  // Optionally pre-compute the set of product IDs that already have at least
  // one ingredient association. Then we filter to either the complement
  // (missing INCI) or skip the join entirely.
  let missingIds: number[] | null = null;
  if (opts.missingInci) {
    // The product_ingredients table is bounded to ~hundreds of thousands of
    // rows; we pull distinct product_ids in chunks. Postgres will hash this
    // happily for our scale (33k products).
    const present = new Set<number>();
    let from = 0;
    const PAGE = 1000;
    // Bounded loop — never more than ~500 iterations even at full scale.
    for (let i = 0; i < 500; i++) {
      const { data, error } = await sb
        .schema("cosme_check")
        .from("product_ingredients")
        .select("product_id")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as { product_id: number }[]) present.add(r.product_id);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Fetch every product id and subtract the "present" set. We only need
    // ids here, so the payload stays small.
    const allIds: number[] = [];
    let pFrom = 0;
    const PSIZE = 5000;
    for (let i = 0; i < 50; i++) {
      const { data, error } = await sb
        .schema("cosme_check")
        .from("products")
        .select("id")
        .order("id", { ascending: false })
        .range(pFrom, pFrom + PSIZE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as { id: number }[]) {
        if (!present.has(r.id)) allIds.push(r.id);
      }
      if (data.length < PSIZE) break;
      pFrom += PSIZE;
    }
    missingIds = allIds;
  }

  // Build the main query.
  let query = sb
    .schema("cosme_check")
    .from("products")
    .select("id, inci_product_id, brand, name, volume, score, image_url, source_url, scraped_at", {
      count: "exact",
    });

  if (search) {
    // OR across brand / name. ilike to stay case-insensitive.
    const needle = `%${search.replace(/[%_]/g, "")}%`;
    query = query.or(`brand.ilike.${needle},name.ilike.${needle}`);
  }

  if (missingIds !== null) {
    if (missingIds.length === 0) {
      return { rows: [], total: 0, page, size, hasNext: false };
    }
    // Supabase .in() supports thousands of values; the URL length cap on
    // Postgrest is generous (~16 MB). At ~33 k ids worst-case we're fine.
    query = query.in("id", missingIds);
  }

  const fromIdx = (page - 1) * size;
  const toIdx = fromIdx + size - 1;

  const { data, count, error } = await query
    .order("scraped_at", { ascending: false, nullsFirst: false })
    .range(fromIdx, toIdx);

  if (error) {
    return { rows: [], total: 0, page, size, hasNext: false };
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []) as ProductRow[],
    total,
    page,
    size,
    hasNext: fromIdx + (data?.length ?? 0) < total,
  };
}
