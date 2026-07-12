"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { Expense } from "@/lib/queries/finance";

type Item = { label: string; value: number; color: string };
type Bucket = {
  label: string;
  ai: number;
  recurring: number;
  oneTime: number;
  total: number;
  items: Item[];
};

const RECUR = "#8b5cf6";
const AI = "#f43f5e";
const ONE = "#f59e0b";

const PRESETS = [
  { key: "1d", label: "1 jour", days: 1 },
  { key: "1w", label: "Semaine", days: 7 },
  { key: "1m", label: "Mois", days: 30 },
  { key: "3m", label: "3 mois", days: 90 },
  { key: "6m", label: "6 mois", days: 180 },
  { key: "custom", label: "Perso", days: 0 },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const perMonthOf = (e: Expense) =>
  e.period === "monthly" ? e.amount_eur : e.period === "annual" ? e.amount_eur / 12 : 0;

export function MonthlyExpenseChart({
  aiDaily,
  expenses,
  recurringRunRate,
}: {
  aiDaily: { day: string; eur: number }[];
  expenses: Expense[];
  recurringRunRate: number;
}) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("6m");
  const today = iso(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const { buckets, granularity } = useMemo(() => {
    // Détermine la plage [start, end].
    let start: Date, end: Date;
    if (preset === "custom") {
      start = new Date(from + "T00:00:00Z");
      end = new Date(to + "T00:00:00Z");
      if (end < start) [start, end] = [end, start];
    } else {
      const days = PRESETS.find((p) => p.key === preset)!.days;
      end = new Date(today + "T00:00:00Z");
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (days - 1));
    }
    const rangeDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const gran: "day" | "month" = rangeDays <= 45 ? "day" : "month";

    const aiByDay = new Map(aiDaily.map((r) => [r.day, r.eur]));
    const active = expenses.filter((e) => e.active);
    // Abonnements récurrents (mensuel/annuel) actifs — détaillés par NOM dans le tooltip.
    const recurringActive = active.filter((e) => e.period !== "one_time" && perMonthOf(e) > 0);

    const out: Bucket[] = [];
    if (gran === "day") {
      for (let i = 0; i < rangeDays; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        const key = iso(d);
        const dim = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
        const ai = aiByDay.get(key) ?? 0;
        const oneTimeList = active.filter((e) => e.period === "one_time" && e.occurred_on === key);
        const oneTime = oneTimeList.reduce((s, e) => s + e.amount_eur, 0);
        const recurring = recurringRunRate / dim;
        const items: Item[] = [
          ...recurringActive.map((e) => ({ label: e.label, value: perMonthOf(e) / dim, color: RECUR })),
          ...(ai > 0 ? [{ label: "IA (OpenAI)", value: ai, color: AI }] : []),
          ...oneTimeList.map((e) => ({ label: e.label, value: e.amount_eur, color: ONE })),
        ];
        out.push({ label: key.slice(5), ai, recurring, oneTime, total: ai + recurring + oneTime, items });
      }
    } else {
      // buckets mensuels de start.month à end.month
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      while (cur <= last) {
        const ym = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
        let ai = 0;
        for (const [day, eur] of aiByDay) if (day.slice(0, 7) === ym) ai += eur;
        const oneTimeList = active.filter((e) => e.period === "one_time" && e.occurred_on.slice(0, 7) === ym);
        const oneTime = oneTimeList.reduce((s, e) => s + e.amount_eur, 0);
        const recurring = recurringRunRate;
        const items: Item[] = [
          ...recurringActive.map((e) => ({ label: e.label, value: perMonthOf(e), color: RECUR })),
          ...(ai > 0 ? [{ label: "IA (OpenAI)", value: ai, color: AI }] : []),
          ...oneTimeList.map((e) => ({ label: e.label, value: e.amount_eur, color: ONE })),
        ];
        out.push({ label: ym.slice(2), ai, recurring, oneTime, total: ai + recurring + oneTime, items });
        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }
    }
    return { buckets: out, granularity: gran };
  }, [preset, from, to, today, aiDaily, expenses, recurringRunRate]);

  const rangeTotal = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              preset === p.key
                ? "bg-rose-600 text-white"
                : "border border-black/10 text-muted-foreground hover:bg-black/[0.04]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <span className="ml-1 inline-flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-black/10 px-2 py-1 text-[12px]"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-black/10 px-2 py-1 text-[12px]"
            />
          </span>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">
          Total période : <span className="font-semibold text-foreground">{rangeTotal.toFixed(2)} €</span>
          <span className="ml-1">({granularity === "day" ? "par jour" : "par mois"})</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}€`} width={46} />
          <Tooltip content={<DetailTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="recurring" name="Abonnements" stackId="a" fill={RECUR} />
          <Bar dataKey="ai" name="IA (OpenAI)" stackId="a" fill={AI} />
          <Bar dataKey="oneTime" name="Ponctuel" stackId="a" fill={ONE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Tooltip détaillé : liste CHAQUE dépense par son nom (abonnements, IA,
 * ponctuels) avec sa pastille de couleur et son montant, + le total — au lieu
 * des simples totaux par groupe.
 */
function DetailTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: Bucket }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;
  const items = bucket.items.filter((it) => it.value > 0.004);
  if (items.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 shadow-lg"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} />
            <span className="mr-4 max-w-[210px] truncate text-foreground/80">{it.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {it.value.toFixed(2)} €
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-black/[0.06] pt-1.5 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{bucket.total.toFixed(2)} €</span>
      </div>
    </div>
  );
}
