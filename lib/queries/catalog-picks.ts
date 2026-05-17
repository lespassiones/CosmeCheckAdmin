/**
 * Daily picks — read helpers for the /catalog/daily-picks admin page.
 *
 * Daily picks are the rotating "quiz of the day" + "myth of the day" cards
 * shown on the CosmetWiki app home. The mobile client selects 10 picks per
 * day deterministically based on `order_index`. Admin can edit them inline.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type PickKind = "quiz" | "myth";
export type PickView = "all" | "quiz" | "myth";

export type DailyPick = {
  id: string;
  kind: PickKind;
  order_index: number;
  question: string;
  options: string[];
  correct_index: number;
  reveal: string | null;
  category: string | null;
};

export type PicksKpis = {
  total: number;
  byKind: { quiz: number; myth: number };
  /** Order indices 1-10 = the "current 10 of the day" slice. */
  currentSlice: number;
};

export async function fetchPicksKpis(): Promise<PicksKpis> {
  const sb = supabaseAdmin();
  const [totalRes, quizRes, mythRes, sliceRes] = await Promise.all([
    sb.schema("cosme_check").from("daily_picks").select("id", { count: "exact", head: true }),
    sb
      .schema("cosme_check")
      .from("daily_picks")
      .select("id", { count: "exact", head: true })
      .eq("kind", "quiz"),
    sb
      .schema("cosme_check")
      .from("daily_picks")
      .select("id", { count: "exact", head: true })
      .eq("kind", "myth"),
    sb
      .schema("cosme_check")
      .from("daily_picks")
      .select("id", { count: "exact", head: true })
      .gte("order_index", 1)
      .lte("order_index", 10),
  ]);

  return {
    total: totalRes.count ?? 0,
    byKind: { quiz: quizRes.count ?? 0, myth: mythRes.count ?? 0 },
    currentSlice: sliceRes.count ?? 0,
  };
}

export async function listPicks(opts: { view?: PickView; limit?: number }): Promise<DailyPick[]> {
  const sb = supabaseAdmin();
  const limit = Math.min(500, Math.max(10, opts.limit ?? 200));
  const view: PickView = opts.view ?? "all";

  let q = sb
    .schema("cosme_check")
    .from("daily_picks")
    .select("id, kind, order_index, question, options, correct_index, reveal, category");

  if (view === "quiz" || view === "myth") q = q.eq("kind", view);

  const { data, error } = await q.order("order_index", { ascending: true }).limit(limit);
  if (error || !data) return [];

  return (data as Array<{
    id: string;
    kind: string;
    order_index: number;
    question: string;
    options: string[] | null;
    correct_index: number | null;
    reveal: string | null;
    category: string | null;
  }>).map((r) => ({
    id: r.id,
    kind: (r.kind === "myth" ? "myth" : "quiz") as PickKind,
    order_index: r.order_index,
    question: r.question ?? "",
    options: Array.isArray(r.options) ? r.options : [],
    correct_index: r.correct_index ?? 0,
    reveal: r.reveal,
    category: r.category,
  }));
}
