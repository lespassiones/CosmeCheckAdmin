"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export type SvcResult = { ok: true } | { ok: false; error: string };

export type SaveServiceInput = {
  id: string;
  used_mobile: boolean;
  used_web: boolean;
  billing: "free" | "paid";
  monthly_amount_eur: number | null;
  active: boolean;
};

/**
 * Enregistre une ligne de service + répercute sur la Finance.
 *
 * Règle : un service « Payant » + montant valide + « Actif » = une dépense
 * mensuelle dans finance_expenses (créée puis mise à jour via finance_expense_id).
 * Si le service repasse « Gratuit » ou « inactif », la dépense liée est
 * DÉSACTIVÉE (active=false) — on garde l'historique, elle sort du run-rate.
 */
export async function saveService(input: SaveServiceInput): Promise<SvcResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();

  const { data: current, error: readErr } = await sb
    .schema("cosme_check")
    .from("external_services")
    .select("name, finance_expense_id")
    .eq("id", input.id)
    .single();
  if (readErr || !current) return { ok: false, error: "Service introuvable." };

  const billing = input.billing === "paid" ? "paid" : "free";
  const rawAmount = Number(input.monthly_amount_eur);
  const amount =
    billing === "paid" && Number.isFinite(rawAmount) ? Number(rawAmount.toFixed(2)) : null;

  if (billing === "paid" && (amount === null || amount <= 0)) {
    return { ok: false, error: "Renseigne un montant mensuel valide pour un service payant." };
  }

  const shouldSync = billing === "paid" && input.active && amount !== null;
  let financeExpenseId = (current.finance_expense_id as string | null) ?? null;

  if (shouldSync) {
    if (financeExpenseId) {
      const { error } = await sb
        .schema("cosme_check")
        .from("finance_expenses")
        .update({
          label: `${current.name} (service)`,
          amount_eur: amount,
          amount_original: amount,
          currency_original: "EUR",
          active: true,
        })
        .eq("id", financeExpenseId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: ins, error } = await sb
        .schema("cosme_check")
        .from("finance_expenses")
        .insert({
          label: `${current.name} (service)`,
          amount_eur: amount,
          kind: "fixed",
          period: "monthly",
          category: "subscription",
          amount_original: amount,
          currency_original: "EUR",
          note: "Créé automatiquement depuis « Services annexes ».",
          occurred_on: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (error || !ins) return { ok: false, error: error?.message ?? "Erreur Finance." };
      financeExpenseId = ins.id as string;
    }
  } else if (financeExpenseId) {
    await sb
      .schema("cosme_check")
      .from("finance_expenses")
      .update({ active: false })
      .eq("id", financeExpenseId);
  }

  const { error: upErr } = await sb
    .schema("cosme_check")
    .from("external_services")
    .update({
      used_mobile: input.used_mobile,
      used_web: input.used_web,
      billing,
      monthly_amount_eur: amount,
      active: input.active,
      finance_expense_id: financeExpenseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (upErr) return { ok: false, error: upErr.message };

  await logAudit({ adminEmail: admin.email, action: "services.save" });
  revalidatePath("/services");
  revalidatePath("/finance");
  return { ok: true };
}
