/**
 * Modération produit pour la page « Retours › Modération produit ».
 *
 *   - Signalements d'erreur (user_feedback, kind='product_error') : un
 *     utilisateur signale une info incorrecte sur un produit analysé.
 *   - Photos proposées (catalog_photo_submissions) : 1 ou 2 photos envoyées
 *     pour un produit sans image, en attente de validation.
 *
 * Lectures via supabaseAdmin() (service_role, bypass RLS). On enrichit avec le
 * prénom (user_profiles) + l'email (auth.admin.listUsers).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "cosmetwiki-products";

export type ProductErrorRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_first_name: string | null;
  product_ean: string | null;
  product_name: string | null;
  message: string | null;
  created_at: string;
};

export type PhotoSubmissionStatus = "pending" | "approved" | "rejected";

export type PhotoSubmissionRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_first_name: string | null;
  ean: string | null;
  brand: string | null;
  name: string | null;
  category: string | null;
  photo_url_1: string;
  photo_path_1: string;
  photo_url_2: string | null;
  photo_path_2: string | null;
  status: PhotoSubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
};

/** Résout prénom (user_profiles) + email (auth) pour un lot d'user_ids. */
async function resolveIdentities(
  userIds: string[],
): Promise<Map<string, { email: string | null; firstName: string | null }>> {
  const map = new Map<string, { email: string | null; firstName: string | null }>();
  const wanted = new Set(userIds.filter(Boolean));
  if (wanted.size === 0) return map;

  const sb = supabaseAdmin();

  // Prénoms depuis cosme_check.user_profiles.
  const { data: profiles } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .select("id, first_name")
    .in("id", Array.from(wanted));
  const nameById = new Map<string, string | null>();
  for (const p of (profiles ?? []) as Array<{ id: string; first_name: string | null }>) {
    nameById.set(p.id, p.first_name ?? null);
  }

  // Emails depuis l'Admin API auth.
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map<string, string | null>();
  for (const u of users?.users ?? []) {
    if (wanted.has(u.id)) emailById.set(u.id, u.email ?? null);
  }

  for (const id of wanted) {
    map.set(id, {
      email: emailById.get(id) ?? null,
      firstName: nameById.get(id) ?? null,
    });
  }
  return map;
}

export async function fetchProductErrorReports(limit = 100): Promise<ProductErrorRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .schema("cosme_check")
    .from("user_feedback")
    .select("id, user_id, product_ean, product_name, message, created_at")
    .eq("kind", "product_error")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));

  if (error || !data) return [];

  const rows = data as Array<Omit<ProductErrorRow, "user_email" | "user_first_name">>;
  const ids = rows.map((r) => r.user_id).filter((id): id is string => !!id);
  const identities = await resolveIdentities(ids);

  return rows.map((r) => {
    const idn = r.user_id ? identities.get(r.user_id) : undefined;
    return {
      ...r,
      user_email: idn?.email ?? null,
      user_first_name: idn?.firstName ?? null,
    };
  });
}

export async function fetchPhotoSubmissions(
  status: PhotoSubmissionStatus | "all" = "pending",
  limit = 100,
): Promise<PhotoSubmissionRow[]> {
  const sb = supabaseAdmin();
  let q = sb
    .schema("cosme_check")
    .from("catalog_photo_submissions")
    .select(
      "id, user_id, ean, brand, name, category, photo_path_1, photo_path_2, status, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));

  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error || !data) return [];

  type Raw = {
    id: string;
    user_id: string | null;
    ean: string | null;
    brand: string | null;
    name: string | null;
    category: string | null;
    photo_path_1: string;
    photo_path_2: string | null;
    status: PhotoSubmissionStatus;
    created_at: string;
    reviewed_at: string | null;
  };
  const rows = data as Raw[];
  const ids = rows.map((r) => r.user_id).filter((id): id is string => !!id);
  const identities = await resolveIdentities(ids);

  const publicUrl = (path: string) =>
    sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return rows.map((r) => {
    const idn = r.user_id ? identities.get(r.user_id) : undefined;
    return {
      id: r.id,
      user_id: r.user_id,
      user_email: idn?.email ?? null,
      user_first_name: idn?.firstName ?? null,
      ean: r.ean,
      brand: r.brand,
      name: r.name,
      category: r.category,
      photo_path_1: r.photo_path_1,
      photo_url_1: publicUrl(r.photo_path_1),
      photo_path_2: r.photo_path_2,
      photo_url_2: r.photo_path_2 ? publicUrl(r.photo_path_2) : null,
      status: r.status,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    };
  });
}

export async function countPendingModeration(): Promise<{ errors: number; photos: number }> {
  const sb = supabaseAdmin();
  const [{ count: errors }, { count: photos }] = await Promise.all([
    sb
      .schema("cosme_check")
      .from("user_feedback")
      .select("id", { count: "exact", head: true })
      .eq("kind", "product_error"),
    sb
      .schema("cosme_check")
      .from("catalog_photo_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return { errors: errors ?? 0, photos: photos ?? 0 };
}
