/**
 * Instant loading skeleton for every page inside the (dashboard) route
 * group. Next.js renders this synchronously the moment a user clicks any
 * sidebar link — well before the destination page finishes fetching its
 * data — so navigation always feels instant.
 *
 * Each page still owns its own per-section Suspense boundaries for
 * streaming the real data in once the route has committed.
 */
import { Shimmer, StatCardsRow, ChartCardSkeleton } from "@/components/Skeletons";

export default function DashboardLoading() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Shimmer className="h-8 w-48" />
          <Shimmer className="mt-2 h-3.5 w-72" />
        </div>
      </header>

      <Shimmer className="mb-3 h-4 w-40" />
      <StatCardsRow count={4} />

      <Shimmer className="mb-3 h-4 w-40" />
      <ChartCardSkeleton rows={2} />
    </>
  );
}
