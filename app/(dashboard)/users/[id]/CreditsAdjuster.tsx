"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  grantBonusCredits,
  setUserOverride,
  clearUserOverride,
  resetCreditsToday,
} from "../actions";
import type { RenewalPeriod } from "@/lib/queries/users";

const BONUS_PRESETS = [5, 10, 25, 50, 100] as const;

const PERIOD_LABELS: Record<RenewalPeriod, string> = {
  one_time: "Une seule fois",
  daily: "Par jour",
  weekly: "Par semaine",
  monthly: "Par mois",
  yearly: "Par an",
};

/**
 * Per-user credit controls (canonical model):
 *  - Donner des crédits bonus  → additive, non-renewable (cosme_check_admin_grant_credits)
 *  - Override de la limite      → custom amount + period (cosme_check_admin_set_override)
 *  - Réinitialiser le compteur  → zero today's usage (cosme_check_admin_reset_today)
 * All three reflect immediately on web AND mobile.
 */
export function CreditsAdjuster({
  userId,
  limit,
  renewalPeriod,
  hasOverride,
}: {
  userId: string;
  limit: number;
  renewalPeriod: RenewalPeriod;
  hasOverride: boolean;
}) {
  const [bonus, setBonus] = useState("10");
  const [bonusNote, setBonusNote] = useState("");
  const [ovrAmount, setOvrAmount] = useState(String(limit));
  const [ovrPeriod, setOvrPeriod] = useState<RenewalPeriod>(renewalPeriod);
  const [pending, startTransition] = useTransition();

  function grant(value: number) {
    if (!Number.isFinite(value) || value === 0) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", userId);
      fd.append("amount", String(Math.floor(value)));
      if (bonusNote.trim()) fd.append("note", bonusNote.trim());
      const r = await grantBonusCredits(fd);
      if (r.ok) {
        toast.success(`${value > 0 ? "+" : ""}${Math.floor(value)} crédits bonus`);
        setBonusNote("");
      } else toast.error(r.error);
    });
  }

  function applyOverride() {
    const v = Number(ovrAmount);
    if (!Number.isFinite(v) || v < 0) return toast.error("Montant invalide.");
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", userId);
      fd.append("amount", String(Math.floor(v)));
      fd.append("period", ovrPeriod);
      const r = await setUserOverride(fd);
      if (r.ok) toast.success(`Limite: ${Math.floor(v)} · ${PERIOD_LABELS[ovrPeriod]}`);
      else toast.error(r.error);
    });
  }

  function clearOverride() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", userId);
      const r = await clearUserOverride(fd);
      if (r.ok) toast.success("Override retiré (retour au tier).");
      else toast.error(r.error);
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
    <div className="mt-5 space-y-5 border-t border-black/[0.04] pt-4">
      {/* ── Bonus credits (primary) ─────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Donner des crédits bonus (ponctuel, non renouvelable)
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {BONUS_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => grant(p)}
              className="pill text-[11px] hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-200/60 disabled:opacity-50"
            >
              +{p}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            className="input-base !rounded-full !py-2 !px-4 w-24"
            disabled={pending}
          />
          <input
            type="text"
            value={bonusNote}
            onChange={(e) => setBonusNote(e.target.value)}
            placeholder="Note (ex: geste commercial)"
            className="input-base !rounded-full !py-2 !px-4 flex-1"
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => grant(Number(bonus))}
            disabled={pending}
            className="btn-primary !py-2 !px-4 !text-[13px]"
          >
            {pending ? "…" : "Donner"}
          </button>
        </div>
      </div>

      {/* ── Limit override (advanced) ───────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Override de la limite {hasOverride && <span className="text-amber-600">· actif</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            min={0}
            max={100000}
            value={ovrAmount}
            onChange={(e) => setOvrAmount(e.target.value)}
            className="input-base !rounded-full !py-2 !px-4 w-24"
            disabled={pending}
          />
          <select
            value={ovrPeriod}
            onChange={(e) => setOvrPeriod(e.target.value as RenewalPeriod)}
            className="input-base !rounded-full !py-2 !px-4"
            disabled={pending}
          >
            {(Object.keys(PERIOD_LABELS) as RenewalPeriod[]).map((p) => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
          <button type="button" onClick={applyOverride} disabled={pending} className="btn-primary !py-2 !px-4 !text-[13px]">
            Appliquer
          </button>
          {hasOverride && (
            <button
              type="button"
              onClick={clearOverride}
              disabled={pending}
              className="rounded-full px-3 py-2 text-[12px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Retirer
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
      >
        Réinitialiser le compteur du jour à 0
      </button>
    </div>
  );
}
