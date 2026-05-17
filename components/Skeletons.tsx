/**
 * Skeleton primitives used as Suspense fallbacks across the dashboard.
 *
 * The goal is "click feels instant": the page header + structural shell
 * render synchronously, and each data-heavy block is wrapped in a Suspense
 * boundary whose fallback is one of these skeletons. Data then streams in
 * progressively without ever blocking navigation.
 */
import { cn } from "@/lib/utils";

/** Base shimmering block. Use as the building atom for any custom shape. */
export function Shimmer({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-md bg-gradient-to-r from-slate-200/70 via-slate-100/90 to-slate-200/70",
        className,
      )}
    />
  );
}

/** Matches one <StatCard /> footprint (label + big number + hint). */
export function StatCardSkeleton() {
  return (
    <article className="neo-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-9 w-9 rounded-xl" />
      </div>
      <Shimmer className="mt-3 h-7 w-24" />
      <Shimmer className="mt-2.5 h-3 w-32" />
    </article>
  );
}

/** A row of N stat cards. */
export function StatCardsRow({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "mb-8 grid gap-3",
        count <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Card with a title + a tall area meant for a chart. */
export function ChartCardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div
      className={cn(
        "mb-8 grid gap-4",
        rows === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2",
      )}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <article key={i} className="neo-card p-5">
          <Shimmer className="mb-2 h-3 w-32" />
          <Shimmer className="mb-3 h-6 w-24" />
          <Shimmer className="h-40 w-full" />
        </article>
      ))}
    </div>
  );
}

/** Table-like list skeleton (used in activity tables, users tables). */
export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <article className="neo-card mb-8 overflow-hidden">
      <div className="border-b border-black/[0.04] bg-muted/60 px-5 py-3">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Shimmer key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-4 px-5 py-3.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Shimmer key={c} className={cn("h-3.5", c === 0 ? "w-40" : "w-24")} />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

/** Vertical list of items (top-N lists, simple lists). */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <article className="neo-card p-5">
      <Shimmer className="mb-3 h-3 w-32" />
      <ul className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Shimmer className="h-5 w-5 rounded-full" />
              <Shimmer className="h-3.5 w-32" />
            </div>
            <Shimmer className="h-3.5 w-10" />
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Big block used as a generic fallback. */
export function CardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <article className="neo-card p-6">
      <Shimmer className={cn("w-full", height)} />
    </article>
  );
}

/** Single line. */
export function LineSkeleton({ className }: { className?: string }) {
  return <Shimmer className={cn("h-4 w-48", className)} />;
}
