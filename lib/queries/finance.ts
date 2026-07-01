import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Finance : dépenses fixes/variables (table finance_expenses, en EUR) + coûts
 * IA réels (openai_cost_daily, USD → EUR). Monnaie unique d'affichage = EUR.
 *
 * Taux USD→EUR : constante (pas d'appel externe pour rester déterministe). À
 * ajuster ici si besoin. La conversion ne concerne QUE les coûts IA OpenAI.
 */
export const USD_TO_EUR = 0.92;

export type ExpenseKind = "fixed" | "variable";
export type ExpensePeriod = "monthly" | "annual" | "one_time";

export type Expense = {
  id: string;
  label: string;
  amount_eur: number;
  kind: ExpenseKind;
  period: ExpensePeriod;
  category: string;
  amount_original: number | null;
  currency_original: string | null;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  active: boolean;
  created_at: string;
};

export type FinanceOverview = {
  // Run-rate mensuel des abonnements récurrents (mensuel + annuel/12).
  recurringMonthlyEUR: number;
  recurringFixedMonthlyEUR: number;
  recurringVariableMonthlyEUR: number;
  // Ce mois calendaire : récurrent + ponctuels du mois + IA du mois.
  thisMonthTotalEUR: number;
  thisMonthAiEUR: number;
  // Annuel estimé (run-rate ×12 + IA 12 derniers mois + ponctuels de l'année).
  annualEstimateEUR: number;
  // Provision OpenAI (prépayé, category='provision') vs consommé IA (total).
  provisionOpenAiEUR: number;
  aiConsumedTotalEUR: number;
  provisionRemainingEUR: number;
  // Série 12 mois pour le graphe.
  series: { month: string; ai: number; recurring: number; oneTime: number; total: number }[];
  // IA quotidienne (EUR) sur ~12 mois — pour le filtre de période côté client.
  aiDailyEUR: { day: string; eur: number }[];
  // Run-rate récurrent mensuel (pour ventiler par jour côté client).
  recurringMonthlyRunRate: number;
};

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function listExpenses(): Promise<Expense[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .schema("cosme_check")
    .from("finance_expenses")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Expense[];
}

export async function fetchFinanceOverview(): Promise<FinanceOverview> {
  const sb = supabaseAdmin();
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const sinceDay = since.toISOString().slice(0, 10);

  const [expRes, aiRes] = await Promise.all([
    sb.schema("cosme_check").from("finance_expenses").select("*"),
    sb
      .schema("cosme_check")
      .from("openai_cost_daily")
      .select("day, amount_usd")
      .gte("day", sinceDay),
  ]);

  const expenses = (expRes.data ?? []) as Expense[];
  const aiDaily = (aiRes.data ?? []) as { day: string; amount_usd: number }[];

  // IA par mois, converti en EUR.
  const aiByMonth = new Map<string, number>();
  const aiDailyEUR: { day: string; eur: number }[] = [];
  let aiConsumedTotalEUR = 0;
  for (const r of aiDaily) {
    const eur = Number(r.amount_usd) * USD_TO_EUR;
    const key = r.day.slice(0, 7); // YYYY-MM
    aiByMonth.set(key, (aiByMonth.get(key) ?? 0) + eur);
    aiDailyEUR.push({ day: r.day, eur: Number(eur.toFixed(4)) });
    aiConsumedTotalEUR += eur;
  }
  aiDailyEUR.sort((a, b) => a.day.localeCompare(b.day));

  const active = expenses.filter((e) => e.active);
  const perMonthEUR = (e: Expense) =>
    e.period === "monthly" ? e.amount_eur : e.period === "annual" ? e.amount_eur / 12 : 0;

  const recurringFixedMonthlyEUR = active
    .filter((e) => e.kind === "fixed" && e.period !== "one_time")
    .reduce((s, e) => s + perMonthEUR(e), 0);
  const recurringVariableMonthlyEUR = active
    .filter((e) => e.kind === "variable" && e.period !== "one_time")
    .reduce((s, e) => s + perMonthEUR(e), 0);
  const recurringMonthlyEUR = recurringFixedMonthlyEUR + recurringVariableMonthlyEUR;

  // Série 12 mois.
  const series: FinanceOverview["series"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    const ai = aiByMonth.get(key) ?? 0;
    // ponctuels tombant ce mois-là
    const oneTime = active
      .filter((e) => e.period === "one_time" && e.occurred_on.slice(0, 7) === key)
      .reduce((s, e) => s + e.amount_eur, 0);
    // récurrent actif ce mois (occurred_on <= fin de mois)
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const recurring = active
      .filter((e) => e.period !== "one_time" && e.occurred_on <= endOfMonth)
      .reduce((s, e) => s + perMonthEUR(e), 0);
    series.push({ month: key, ai, recurring, oneTime, total: ai + recurring + oneTime });
  }

  const thisMonthKey = monthKey(now);
  const thisMonth = series.find((s) => s.month === thisMonthKey);
  const thisMonthAiEUR = thisMonth?.ai ?? 0;
  const thisMonthTotalEUR = thisMonth?.total ?? recurringMonthlyEUR;

  const oneTimeThisYear = active
    .filter((e) => e.period === "one_time" && e.occurred_on.slice(0, 4) === String(now.getUTCFullYear()))
    .reduce((s, e) => s + e.amount_eur, 0);
  const aiLast12 = series.reduce((s, m) => s + m.ai, 0);
  const annualEstimateEUR = recurringMonthlyEUR * 12 + aiLast12 + oneTimeThisYear;

  const provisionOpenAiEUR = expenses
    .filter((e) => e.category === "provision")
    .reduce((s, e) => s + e.amount_eur, 0);
  const provisionRemainingEUR = provisionOpenAiEUR - aiConsumedTotalEUR;

  return {
    recurringMonthlyEUR,
    recurringFixedMonthlyEUR,
    recurringVariableMonthlyEUR,
    thisMonthTotalEUR,
    thisMonthAiEUR,
    annualEstimateEUR,
    provisionOpenAiEUR,
    aiConsumedTotalEUR,
    provisionRemainingEUR,
    series,
    aiDailyEUR,
    recurringMonthlyRunRate: recurringMonthlyEUR,
  };
}
