"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PALETTE = [
  "#F43F5E", // rose-500
  "#8B5CF6", // violet-500
  "#0EA5E9", // sky-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EC4899", // pink-500
  "#6366F1", // indigo-500
  "#14B8A6", // teal-500
  "#EF4444", // red-500
  "#A855F7", // purple-500
  "#22C55E", // green-500
  "#F97316", // orange-500
];

export function CategoryPie({
  data,
}: {
  data: Array<{ key: string; count: number }>;
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="key"
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={84}
            paddingAngle={2}
            stroke="#FFFFFF"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.06)",
              boxShadow: "0 12px 32px -12px rgba(15,23,42,0.18)",
              fontSize: 12,
              padding: "8px 12px",
            }}
            formatter={(v: number, name: string) => [v, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
