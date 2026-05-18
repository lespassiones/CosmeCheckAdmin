/**
 * Feedback feed for the "Retours" page.
 *
 *   - Avis (kind='feedback')  : star rating 1-5 from signed-in users.
 *   - Contact (kind='contact'): public contact-form messages (may be from a
 *     signed-in user or anonymous).
 *
 * Reads go through supabaseAdmin() so the service role bypasses RLS — admins
 * need to see every row.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type FeedbackKind = "feedback" | "contact";

export type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  user_id: string | null;
  user_email: string | null;
  rating: number | null;
  message: string | null;
  trigger_source: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  contact_subject: string | null;
  created_at: string;
};

export type FeedbackKpis = {
  totalFeedback: number;
  averageRating: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  totalContact: number;
  contactLast7Days: number;
};

type RawRow = {
  id: string;
  kind: FeedbackKind;
  user_id: string | null;
  rating: number | null;
  message: string | null;
  trigger_source: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  contact_subject: string | null;
  created_at: string;
};

async function resolveEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const sb = supabaseAdmin();
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const map = new Map<string, string>();
  if (!data) return map;
  const wanted = new Set(userIds);
  for (const u of data.users) {
    if (u.email && wanted.has(u.id)) map.set(u.id, u.email);
  }
  return map;
}

export async function fetchFeedbackKpis(): Promise<FeedbackKpis> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .schema("cosme_check")
    .from("user_feedback")
    .select("kind, rating, created_at");

  if (error || !data) {
    return {
      totalFeedback: 0,
      averageRating: null,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalContact: 0,
      contactLast7Days: 0,
    };
  }

  const rows = data as Array<Pick<RawRow, "kind" | "rating" | "created_at">>;
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let ratingCount = 0;
  let totalContact = 0;
  let contactLast7Days = 0;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const r of rows) {
    if (r.kind === "feedback" && r.rating && r.rating >= 1 && r.rating <= 5) {
      dist[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
      ratingSum += r.rating;
      ratingCount += 1;
    } else if (r.kind === "contact") {
      totalContact += 1;
      if (new Date(r.created_at).getTime() >= sevenDaysAgo) {
        contactLast7Days += 1;
      }
    }
  }

  return {
    totalFeedback: ratingCount,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    ratingDistribution: dist,
    totalContact,
    contactLast7Days,
  };
}

export type FeedbackFilter = {
  kind?: FeedbackKind | "all";
  rating?: 1 | 2 | 3 | 4 | 5 | null;
  limit?: number;
};

export async function fetchFeedbackRows(filter: FeedbackFilter = {}): Promise<FeedbackRow[]> {
  const sb = supabaseAdmin();
  const limit = Math.min(filter.limit ?? 100, 500);

  let q = sb
    .schema("cosme_check")
    .from("user_feedback")
    .select("id, kind, user_id, rating, message, trigger_source, contact_first_name, contact_email, contact_subject, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.kind && filter.kind !== "all") {
    q = q.eq("kind", filter.kind);
  }
  if (filter.rating) {
    q = q.eq("rating", filter.rating);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  const rows = data as RawRow[];
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => !!id);
  const emailMap = userIds.length > 0 ? await resolveEmailMap(userIds) : new Map<string, string>();

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    user_id: r.user_id,
    user_email: r.user_id ? emailMap.get(r.user_id) ?? null : null,
    rating: r.rating,
    message: r.message,
    trigger_source: r.trigger_source,
    contact_first_name: r.contact_first_name,
    contact_email: r.contact_email,
    contact_subject: r.contact_subject,
    created_at: r.created_at,
  }));
}
