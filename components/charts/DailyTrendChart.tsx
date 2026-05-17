"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailySeriesPoint } from "@/lib/queries/overview";

type Series = "analyses" | "signups" | "cost_usd";

const SERIES_META: Record<Series, { label: string; color: string }> = {
  analyses: { label: "Analyses", color: "#F43F5E" },
  signups: { label: "Signups", color: "#8B5CF6" },
  cost_usd: { label: "Coût IA ($)", color: "#0EA5E9" },
};

export function DailyTrendChart({
  data,
  series,
}: {
  data: DailySeriesPoint[];
  series: Series;
}) {
  const meta = SERIES_META[series];
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${series}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            cursor={{ stroke: "#CBD5E1", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.06)",
              boxShadow: "0 12px 32px -12px rgba(15,23,42,0.18)",
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelStyle={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}
            formatter={(v: number) => [series === "cost_usd" ? `$${v.toFixed(3)}` : v, meta.label]}
          />
          <Area
            type="monotone"
            dataKey={series}
            stroke={meta.color}
            strokeWidth={2}
            fill={`url(#grad-${series})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
