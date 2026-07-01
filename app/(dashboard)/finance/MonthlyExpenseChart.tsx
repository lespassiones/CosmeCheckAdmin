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

type Bucket = { label: string; ai: number; recurring: number; oneTime: number; total: number };

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

    const out: Bucket[] = [];
    if (gran === "day") {
      for (let i = 0; i < rangeDays; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        const key = iso(d);
        const ai = aiByDay.get(key) ?? 0;
        const oneTime = active
          .filter((e) => e.period === "one_time" && e.occurred_on === key)
          .reduce((s, e) => s + e.amount_eur, 0);
        const recurring = recurringRunRate / daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
        out.push({ label: key.slice(5), ai, recurring, oneTime, total: ai + recurring + oneTime });
      }
    } else {
      // buckets mensuels de start.month à end.month
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      while (cur <= last) {
        const ym = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
        let ai = 0;
        for (const [day, eur] of aiByDay) if (day.slice(0, 7) === ym) ai += eur;
        const oneTime = active
          .filter((e) => e.period === "one_time" && e.occurred_on.slice(0, 7) === ym)
          .reduce((s, e) => s + e.amount_eur, 0);
        const recurring = recurringRunRate;
        out.push({ label: ym.slice(2), ai, recurring, oneTime, total: ai + recurring + oneTime });
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
          <Tooltip
            formatter={(v: number, name: string) => [`${Number(v).toFixed(2)} €`, name]}
            contentStyle={{ fontSize: 12, borderRadius: 10 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="recurring" name="Abonnements" stackId="a" fill="#8b5cf6" />
          <Bar dataKey="ai" name="IA (OpenAI)" stackId="a" fill="#f43f5e" />
          <Bar dataKey="oneTime" name="Ponctuel" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
