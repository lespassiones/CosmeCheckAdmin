/**
 * Espace marques du site (cosme-check.com/marques) : fiches produits envoyées
 * par les marques, table cosme_check.brand_product_submissions. Lecture via la
 * clé service (la table n'est lisible par personne d'autre).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "cosmetwiki-products";

export type BrandStatus = "pending" | "approved" | "rejected";

export type BrandSubmissionRow = {
  id: string;
  created_at: string;
  status: BrandStatus;
  brand: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string;
  contact_role: string | null;
  brand_website: string | null;
  product_name: string;
  ean: string | null;
  volume: string;
  product_type: string | null;
  zones: string[];
  inci: string;
  properties: string | null;
  made_in: string | null;
  product_url: string | null;
  photo_front_path: string | null;
  photo_inci_path: string | null;
  reviewed_at: string | null;
  reviewer_email: string | null;
  review_note: string | null;
  check_note: string | null;
  catalog_ean: string | null;
  score: number | null;
  score_label: string | null;
  stars: number | null;
  notified_at: string | null;
  photo_front_url: string | null;
  photo_inci_url: string | null;
};

export async function fetchBrandSubmissions(status: BrandStatus | "all", limit = 100): Promise<BrandSubmissionRow[]> {
  const sb = supabaseAdmin();
  let q = sb
    .schema("cosme_check")
    .from("brand_product_submissions")
    .select("*")
    .order("created_at", { ascending: status === "pending" })
    .limit(limit);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    console.warn("[brands] lecture", error.message);
    return [];
  }
  const url = (p: string | null) => (p ? sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl : null);
  return (data ?? []).map((r) => ({
    ...(r as Omit<BrandSubmissionRow, "photo_front_url" | "photo_inci_url">),
    photo_front_url: url(r.photo_front_path),
    photo_inci_url: url(r.photo_inci_path),
  }));
}

export async function countBrandSubmissions(): Promise<Record<BrandStatus, number>> {
  const sb = supabaseAdmin();
  const count = async (s: BrandStatus) =>
    (
      await sb
        .schema("cosme_check")
        .from("brand_product_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
    ).count ?? 0;
  const [pending, approved, rejected] = await Promise.all([count("pending"), count("approved"), count("rejected")]);
  return { pending, approved, rejected };
}
