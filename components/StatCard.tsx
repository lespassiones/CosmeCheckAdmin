import type { LucideIcon } from "lucide-react";
import { cn, formatInt } from "@/lib/utils";

type Tone = "neutral" | "rose" | "emerald" | "amber" | "violet";

const TONE: Record<Tone, string> = {
  neutral: "from-slate-100 to-slate-50 text-slate-700",
  rose: "from-rose-100 to-rose-50 text-rose-700",
  emerald: "from-emerald-100 to-emerald-50 text-emerald-700",
  amber: "from-amber-100 to-amber-50 text-amber-700",
  violet: "from-violet-100 to-violet-50 text-violet-700",
};

export type StatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  delta?: { value: number; positiveIsGood?: boolean } | null;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
};

/**
 * Soft neomorphic KPI card with optional delta indicator.
 *
 *   <StatCard label="Users totaux" value={42} delta={{ value: 3 }} icon={Users} />
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  className,
}: StatCardProps) {
  const formatted = typeof value === "number" ? formatInt(value) : value;
  const deltaTone =
    delta === null || delta === undefined
      ? ""
      : (delta.positiveIsGood ?? true)
        ? delta.value >= 0
          ? "text-emerald-600"
          : "text-rose-600"
        : delta.value >= 0
          ? "text-rose-600"
          : "text-emerald-600";

  return (
    <article
      className={cn(
        "neo-card relative overflow-hidden p-5",
        "transition-all hover:-translate-y-0.5 hover:shadow-glass",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
              TONE[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="mt-3 text-[28px] font-semibold tracking-tight tabular-nums leading-none">
        {formatted}
      </p>

      {(hint || delta) && (
        <p className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground">
          {delta && (
            <span className={cn("font-semibold", deltaTone)}>
              {delta.value >= 0 ? "+" : ""}
              {formatInt(delta.value)}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </article>
  );
}
