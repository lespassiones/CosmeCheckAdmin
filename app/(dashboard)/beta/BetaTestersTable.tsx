"use client";

import { Fragment, useState } from "react";

export type AnswerItem = { q: string; a: string };
export type BetaTesterView = {
  email: string;
  name: string;
  status: string;
  invited: boolean;
  source: string | null;
  createdAt: string;
  intake: AnswerItem[];
  feedback: AnswerItem[];
};

/**
 * Tableau des bêta testeurs avec ligne dépliable : au clic sur « Voir les
 * réponses », on affiche le questionnaire persona (intake) + le retour, chacun
 * sous forme « question → réponse » (auto-décrit, stocké tel quel en base).
 */
export function BetaTestersTable({ rows }: { rows: BetaTesterView[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="p-5 text-[13px] text-muted-foreground">Aucun inscrit pour le moment.</p>;
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-black/[0.06] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className="px-4 py-3 font-medium">Nom</th>
          <th className="px-4 py-3 font-medium">Email</th>
          <th className="px-4 py-3 font-medium">Statut</th>
          <th className="px-4 py-3 font-medium">Source</th>
          <th className="px-4 py-3 font-medium">Inscrit le</th>
          <th className="px-4 py-3 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isOpen = open === r.email;
          const hasAnswers = r.intake.length > 0 || r.feedback.length > 0;
          return (
            <Fragment key={r.email}>
              <tr className="border-b border-black/[0.04]">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} invited={r.invited} /></td>
                <td className="px-4 py-3 text-muted-foreground">{r.source ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right">
                  {hasAnswers ? (
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.email)}
                      className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-50"
                    >
                      {isOpen ? "Masquer" : "Voir les réponses"}
                    </button>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
              {isOpen && (
                <tr className="border-b border-black/[0.04] bg-black/[0.015]">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      <AnswerBlock title="Questionnaire d'inscription (persona)" items={r.intake} />
                      <AnswerBlock title="Retour après test" items={r.feedback} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function AnswerBlock({ title, items }: { title: string; items: AnswerItem[] }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-[12px] italic text-muted-foreground">Aucune réponse.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-[12px] font-medium text-foreground">{it.q}</p>
              <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{it.a}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status, invited }: { status: string; invited: boolean }) {
  if (status === "feedback_recu") {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Retour reçu</span>;
  }
  if (invited) {
    return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">Invité</span>;
  }
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">En attente</span>;
}
