"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDailyLimit, resetCreditsToday } from "../actions";

const PRESETS = [50, 100, 250, 500, 1000, 5000] as const;

export function CreditsAdjuster({
  userId,
  currentLimit,
}: {
  userId: string;
  currentLimit: number;
}) {
  const [draft, setDraft] = useState(String(currentLimit));
  const [pending, startTransition] = useTransition();

  function applyLimit(value: number) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", userId);
      fd.append("limit", String(value));
      const r = await setDailyLimit(fd);
      if (r.ok) {
        toast.success(`Limite mise à ${value} crédits / jour`);
        setDraft(String(value));
      } else {
        toast.error(r.error);
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", userId);
      const r = await resetCreditsToday(fd);
      if (r.ok) toast.success("Compteur du jour remis à 0.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="mt-5 border-t border-black/[0.04] pt-4">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Ajuster la limite du jour
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={pending}
            onClick={() => applyLimit(p)}
            className="pill text-[11px] hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200/60 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        action={(fd) => {
          const v = Number(fd.get("limit") ?? 0);
          if (Number.isFinite(v)) applyLimit(Math.floor(v));
        }}
      >
        <input
          name="limit"
          type="number"
          min={0}
          max={100000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input-base !rounded-full !py-2 !px-4 flex-1"
          disabled={pending}
        />
        <button type="submit" disabled={pending} className="btn-primary !py-2 !px-4 !text-[13px]">
          {pending ? "…" : "Appliquer"}
        </button>
      </form>

      <button
        type="button"
        onClick={reset}
        disabled={pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
      >
        Réinitialiser le compteur du jour à 0
      </button>
    </div>
  );
}
