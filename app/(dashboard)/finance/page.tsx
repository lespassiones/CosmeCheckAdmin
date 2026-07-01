import { Wallet, Repeat, Layers, PiggyBank } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { fetchFinanceOverview, listExpenses } from "@/lib/queries/finance";
import { MonthlyExpenseChart } from "./MonthlyExpenseChart";
import { AddExpenseForm } from "./AddExpenseForm";
import { ExpenseList } from "./ExpenseList";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

const eur = (n: number) => `${n.toFixed(2)} €`;

export default async function FinancePage() {
  const [ov, expenses] = await Promise.all([fetchFinanceOverview(), listExpenses()]);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Dépenses fixes & variables, coûts IA, provisions — en euros."
        info="Vue unique de tes dépenses (monnaie unique : €). Le coût IA réel (OpenAI, USD) est converti et injecté automatiquement chaque mois. Ajoute abonnements/coûts (fixes ou variables, mensuels/annuels/ponctuels) et suis coûts fixes vs variables + la provision OpenAI restante. Base pour la compta future."
      />

      <SectionHeader
        title="Indicateurs clés"
        info="« Ce mois-ci » = abonnements récurrents + coûts ponctuels du mois + IA du mois. « Récurrent /mois » = run-rate des abonnements (mensuel + annuel/12). Provision = crédit OpenAI prépayé moins le consommé réel."
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ce mois-ci" value={eur(ov.thisMonthTotalEUR)} hint={`dont IA ${eur(ov.thisMonthAiEUR)}`} icon={Wallet} tone="rose" />
        <StatCard label="Récurrent / mois" value={eur(ov.recurringMonthlyEUR)} hint="abonnements (run-rate)" icon={Repeat} tone="violet" />
        <StatCard label="Fixe / Variable" value={`${eur(ov.recurringFixedMonthlyEUR)}`} hint={`variable ${eur(ov.recurringVariableMonthlyEUR)} /mois`} icon={Layers} tone="amber" />
        <StatCard
          label="Provision OpenAI"
          value={eur(ov.provisionRemainingEUR)}
          hint={`restant · ${eur(ov.provisionOpenAiEUR)} chargés`}
          icon={PiggyBank}
          tone="emerald"
        />
      </div>

      <SectionHeader
        title="Dépenses mensuelles"
        subtitle="12 derniers mois · en euros"
        info="Empilement par mois : Abonnements (récurrents), IA (OpenAI converti en €), Ponctuel (coûts one-shot du mois, ex frais Google Play)."
      />
      <article className="neo-card mb-8 p-5">
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Total 12 mois</p>
        <p className="mb-3 text-[20px] font-semibold tabular-nums">
          {eur(ov.series.reduce((s, m) => s + m.total, 0))}
        </p>
        <MonthlyExpenseChart data={ov.series} />
      </article>

      <SectionHeader
        title="Ajouter une dépense"
        info="Saisis un abonnement ou un coût. USD converti automatiquement en €. « Provision » = argent chargé d'avance (ex crédit OpenAI). « Ponctuel » = coût one-shot (ex 25€ Google Play)."
      />
      <AddExpenseForm />

      <SectionHeader
        title="Dépenses enregistrées"
        info="Toutes tes dépenses saisies. L'œil désactive une ligne (sans supprimer) ; la corbeille supprime définitivement."
      />
      <ExpenseList expenses={expenses} />
    </>
  );
}
