"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { USD_TO_EUR } from "@/lib/queries/finance";

export type FinResult = { ok: true } | { ok: false; error: string };

export type AddExpenseInput = {
  label: string;
  amount: number;
  currency: "EUR" | "USD";
  kind: "fixed" | "variable";
  period: "monthly" | "annual" | "one_time";
  category: string;
  occurred_on?: string;
  note?: string;
};

/** Ajoute une dépense/abonnement. Convertit USD→EUR à la saisie (monnaie unique EUR). */
export async function addExpense(input: AddExpenseInput): Promise<FinResult> {
  const admin = await requireAdmin();
  const label = (input.label ?? "").trim();
  const amount = Number(input.amount);
  if (!label) return { ok: false, error: "Libellé requis." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };

  const currency = input.currency === "USD" ? "USD" : "EUR";
  const amount_eur = Number((currency === "USD" ? amount * USD_TO_EUR : amount).toFixed(2));
  const period = (["monthly", "annual", "one_time"] as const).includes(input.period) ? input.period : "monthly";

  const sb = supabaseAdmin();
  const { error } = await sb.schema("cosme_check").from("finance_expenses").insert({
    label: label.slice(0, 200),
    amount_eur,
    kind: input.kind === "variable" ? "variable" : "fixed",
    period,
    category: (input.category || "other").slice(0, 40),
    amount_original: Number(amount.toFixed(2)),
    currency_original: currency,
    note: input.note ? input.note.slice(0, 500) : null,
    occurred_on: input.occurred_on || new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({ adminEmail: admin.email, action: "finance.add_expense" });
  revalidatePath("/finance");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<FinResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb.schema("cosme_check").from("finance_expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ adminEmail: admin.email, action: "finance.delete_expense" });
  revalidatePath("/finance");
  return { ok: true };
}

export async function toggleExpense(id: string, active: boolean): Promise<FinResult> {
  const admin = await requireAdmin();
  const sb = supabaseAdmin();
  const { error } = await sb
    .schema("cosme_check")
    .from("finance_expenses")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ adminEmail: admin.email, action: "finance.toggle_expense" });
  revalidatePath("/finance");
  return { ok: true };
}
