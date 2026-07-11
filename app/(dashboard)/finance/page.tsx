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
        title="Dépenses"
        subtitle="Filtre la période · empilement Abonnements / IA / Ponctuel"
        info="Filtre 1 jour, semaine, mois, 3 mois, 6 mois ou personnalisé. Sous 45 jours = vue quotidienne, au-delà = vue mensuelle. Abonnements récurrents (ventilés), IA (OpenAI converti en €), Ponctuel (coûts one-shot, ex frais Google Play)."
      />
      <article className="neo-card mb-8 p-5">
        <MonthlyExpenseChart
          aiDaily={ov.aiDailyEUR}
          expenses={expenses}
          recurringRunRate={ov.recurringMonthlyRunRate}
        />
      </article>

      <SectionHeader
        title="Dépenses enregistrées"
        subtitle="Le bouton à droite ouvre la saisie (USD converti automatiquement en €)"
        info="Toutes tes dépenses saisies. L'œil désactive une ligne (sans supprimer) ; la corbeille supprime définitivement. « Provision » = argent chargé d'avance (ex crédit OpenAI) ; « Ponctuel » = coût one-shot (ex 25€ Google Play)."
      />
      <AddExpenseForm />
      <ExpenseList expenses={expenses} />
    </>
  );
}
