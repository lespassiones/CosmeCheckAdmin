"use client";

import { useTransition } from "react";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, toggleExpense } from "./actions";
import type { Expense } from "@/lib/queries/finance";

const eur = (n: number) => `${n.toFixed(2)} €`;

const PERIOD_LABEL: Record<string, string> = {
  monthly: "Mensuel",
  annual: "Annuel",
  one_time: "Ponctuel",
};
const CAT_LABEL: Record<string, string> = {
  subscription: "Abonnement",
  infra: "Infra",
  provision: "Provision",
  store: "Store",
  ai: "IA",
  other: "Autre",
};

export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  const [pending, start] = useTransition();

  if (expenses.length === 0) {
    return (
      <article className="glass-card p-6 text-center text-[13px] text-muted-foreground">
        Aucune dépense enregistrée. Ajoute ton premier abonnement ou coût ci-dessus.
      </article>
    );
  }

  return (
    <article className="glass-card overflow-x-auto p-5">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <th className="pb-3 pr-3">Libellé</th>
            <th className="pb-3 px-3">Catégorie</th>
            <th className="pb-3 px-3">Type</th>
            <th className="pb-3 px-3">Périodicité</th>
            <th className="pb-3 px-3 text-right">Montant</th>
            <th className="pb-3 px-3">Date</th>
            <th className="pb-3 pl-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04]">
          {expenses.map((e) => (
            <tr key={e.id} className={e.active ? "" : "opacity-45"}>
              <td className="py-2.5 pr-3 font-medium">
                {e.label}
                {e.currency_original === "USD" && e.amount_original != null && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    (${e.amount_original.toFixed(2)})
                  </span>
                )}
              </td>
              <td className="px-3 text-muted-foreground">{CAT_LABEL[e.category] ?? e.category}</td>
              <td className="px-3">
                <span className={e.kind === "fixed" ? "pill-violet" : "pill-amber"}>
                  {e.kind === "fixed" ? "Fixe" : "Variable"}
                </span>
              </td>
              <td className="px-3 text-muted-foreground">{PERIOD_LABEL[e.period] ?? e.period}</td>
              <td className="px-3 text-right font-semibold tabular-nums">{eur(e.amount_eur)}</td>
              <td className="px-3 text-muted-foreground tabular-nums">{e.occurred_on}</td>
              <td className="py-2.5 pl-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    title={e.active ? "Désactiver" : "Réactiver"}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await toggleExpense(e.id, !e.active);
                        if (!r.ok) toast.error(r.error);
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-black/[0.05] disabled:opacity-50"
                  >
                    {e.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    title="Supprimer"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteExpense(e.id);
                        if (r.ok) toast.success("Supprimé.");
                        else toast.error(r.error);
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
