"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { setDefaultDailyLimit, type CreditScope } from "./actions";

const PRESETS = [10, 20, 50, 100, 250, 500] as const;
const SCOPES: { value: CreditScope; label: string; hint: string }[] = [
  { value: "all", label: "Tous", hint: "free + premium" },
  { value: "free", label: "Free", hint: "non-payants seulement" },
  { value: "premium", label: "Premium", hint: "abonnés seulement" },
];

export function CreditDefaultsForm({ currentDefault }: { currentDefault: number }) {
  const [draft, setDraft] = useState(String(currentDefault));
  const [cascade, setCascade] = useState(false);
  const [scope, setScope] = useState<CreditScope>("all");
  const [pending, startTransition] = useTransition();

  const draftNumber = Number(draft);
  const isValid = Number.isFinite(draftNumber) && draftNumber >= 0 && draftNumber <= 100_000;
  const isUnchanged = draftNumber === currentDefault && !cascade;

  function submit() {
    if (!isValid) {
      toast.error("Valeur invalide (0 à 100 000).");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("new_default", String(Math.floor(draftNumber)));
      if (cascade) fd.append("cascade_today", "on");
      fd.append("scope", scope);

      const r = await setDefaultDailyLimit(fd);
      if (r.ok) {
        const msg = cascade
          ? `Défaut → ${Math.floor(draftNumber)} · ${r.cascadedRows} lignes mises à jour.`
          : `Défaut → ${Math.floor(draftNumber)}. Effectif dès demain.`;
        toast.success(msg);
        setCascade(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Valeurs rapides
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => setDraft(String(p))}
              className="pill text-[11px] hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200/60 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Custom value */}
      <div>
        <label
          htmlFor="new-default"
          className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          Nouvelle valeur par défaut (0 – 100 000)
        </label>
        <input
          id="new-default"
          type="number"
          min={0}
          max={100000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input-base !rounded-full !py-2.5 !px-4 w-full max-w-xs"
          disabled={pending}
        />
      </div>

      {/* Cascade options */}
      <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-black/[0.04]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cascade}
            onChange={(e) => setCascade(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 rounded border-black/20 text-rose-600 focus:ring-rose-500"
          />
          <div className="flex-1">
            <p className="text-[13px] font-medium">
              Appliquer aussi aux users actifs aujourd'hui
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Sans cette case, le changement ne touche que les futures lignes
              (à partir de demain ou pour les users non encore actifs).
            </p>
          </div>
        </label>

        {cascade && (
          <div className="mt-3 ml-7">
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Portée du cascade
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={pending}
                  onClick={() => setScope(s.value)}
                  className={`pill text-[11px] disabled:opacity-50 ${
                    scope === s.value
                      ? "bg-rose-100 text-rose-700 ring-rose-200/60"
                      : "hover:bg-rose-50 hover:text-rose-700"
                  }`}
                  title={s.hint}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {SCOPES.find((s) => s.value === scope)?.hint}
            </p>
          </div>
        )}
      </div>

      {/* Warning when cascade=true */}
      {cascade && draftNumber < currentDefault && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200/60">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-900">
            Tu vas <strong>réduire</strong> la limite de tous les users
            {scope !== "all" ? ` ${scope}` : ""} actifs aujourd'hui. Les users
            ayant déjà consommé plus que la nouvelle valeur seront bloqués
            jusqu'à demain.
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !isValid || isUnchanged}
          className="btn-primary !py-2.5 !px-5 !text-[13px] disabled:opacity-50"
        >
          {pending ? "Application…" : "Appliquer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(String(currentDefault));
            setCascade(false);
            setScope("all");
          }}
          disabled={pending}
          className="btn-secondary !py-2.5 !px-5 !text-[13px] disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
