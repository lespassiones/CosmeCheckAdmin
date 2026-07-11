"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addExpense, type AddExpenseInput } from "./actions";

const CATEGORIES = [
  { value: "subscription", label: "Abonnement" },
  { value: "infra", label: "Infra (Supabase, Vercel…)" },
  { value: "provision", label: "Provision (prépayé OpenAI…)" },
  { value: "store", label: "Store (Google/Apple)" },
  { value: "ai", label: "IA (autre)" },
  { value: "other", label: "Autre" },
];

const input =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-rose-300";
const lbl = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

export function AddExpenseForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<AddExpenseInput>({
    label: "",
    amount: 0,
    currency: "EUR",
    kind: "fixed",
    period: "monthly",
    category: "subscription",
    occurred_on: new Date().toISOString().slice(0, 10),
    note: "",
  });

  function submit() {
    start(async () => {
      const r = await addExpense(form);
      if (r.ok) {
        toast.success("Dépense ajoutée.");
        setForm((f) => ({ ...f, label: "", amount: 0, note: "" }));
        setOpen(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  // Bouton déclencheur : le formulaire complet vit dans une MODAL (demande
  // produit : plus de bloc étiré en pleine page).
  if (!open) {
    return (
      <div className="mb-8 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700"
        >
          <Plus className="h-4 w-4" />
          Ajouter une dépense
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <ModalCard onClose={() => setOpen(false)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={lbl}>Libellé</label>
          <input
            className={input}
            placeholder="Ex : Abonnement Supabase Pro"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
        <div>
          <label className={lbl}>Montant</label>
          <input
            className={input}
            type="number"
            min={0}
            step="0.01"
            value={form.amount || ""}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={lbl}>Devise</label>
          <select
            className={input}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value as AddExpenseInput["currency"] })}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($) → converti en €</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Type</label>
          <select
            className={input}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as AddExpenseInput["kind"] })}
          >
            <option value="fixed">Fixe</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Périodicité</label>
          <select
            className={input}
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value as AddExpenseInput["period"] })}
          >
            <option value="monthly">Mensuel</option>
            <option value="annual">Annuel</option>
            <option value="one_time">Ponctuel</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Catégorie</label>
          <select
            className={input}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Date d&apos;effet</label>
          <input
            className={input}
            type="date"
            value={form.occurred_on}
            onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-semibold text-foreground transition hover:bg-black/5"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Ajout…" : "Ajouter la dépense"}
        </button>
      </div>
      </ModalCard>
    </div>
  );
}

/** Carte de la modal : titre + croix + contenu (le formulaire). */
function ModalCard({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <article className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/[0.06]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">Ajouter une dépense</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </article>
  );
}
