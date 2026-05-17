"use server";

import { requireAdmin } from "@/lib/authGuard";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Batch-generate AI explanations for ingredients that don't have one yet.
 *
 * Wired as a server action behind the "Générer explication" button on the
 * /catalog/ingredients page. We require admin auth so the endpoint can't be
 * hammered by a leaked URL, but the actual generation isn't implemented yet:
 * it requires an OpenAI key and a worker pipeline that we intentionally keep
 * out of the admin web app (long-running, easy to runaway-cost). For now we
 * return a "coming soon" sentinel so the UI can render a placeholder toast.
 */
export async function batchExplain(): Promise<ActionResult> {
  await requireAdmin();
  return { ok: false, error: "Feature coming soon" };
}
