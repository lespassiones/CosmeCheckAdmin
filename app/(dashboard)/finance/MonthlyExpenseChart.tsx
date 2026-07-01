"use client";

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

type Point = { month: string; ai: number; recurring: number; oneTime: number; total: number };

export function MonthlyExpenseChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(m: string) => m.slice(5)} />
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
  );
}
