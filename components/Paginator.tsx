import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pagination partagée (même design que la page Catalogue) : « N par page ·
 * page X » à gauche, numéros autour de la page courante + Précédent/Suivant à
 * droite. Server component (pure liens : l'état vit dans l'URL ?page=N).
 *
 * `makeHref(p)` construit l'URL de la page p en préservant les autres filtres.
 * `hasMore` = il existe une page suivante (count exact pas nécessaire).
 */
export function Paginator({
  page,
  per,
  hasMore,
  makeHref,
  shownCount,
}: {
  page: number;
  per: number;
  hasMore: boolean;
  makeHref: (p: number) => string;
  /** Nombre d'éléments affichés sur CETTE page (pour le libellé). */
  shownCount?: number;
}) {
  // Rien à paginer : pas de chrome inutile.
  if (page === 1 && !hasMore) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
      <span className="text-muted-foreground">
        {per} par page · page {page}
        {typeof shownCount === "number" ? ` · ${shownCount} affiché(s)` : ""}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 && (
          <Link
            href={makeHref(page - 1)}
            className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-black/[0.08] hover:bg-slate-50"
          >
            ← Précédent
          </Link>
        )}
        {Array.from({ length: 5 }, (_, i) => page - 2 + i)
          .filter((p) => p >= 1 && (p <= page || hasMore))
          .map((p) => (
            <Link
              key={p}
              href={makeHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "min-w-[34px] rounded-lg px-2.5 py-1.5 text-center ring-1",
                p === page
                  ? "bg-rose-600 text-white ring-rose-600"
                  : "bg-white ring-black/[0.08] hover:bg-slate-50",
              )}
            >
              {p}
            </Link>
          ))}
        {hasMore && (
          <Link
            href={makeHref(page + 1)}
            className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-black/[0.08] hover:bg-slate-50"
          >
            Suivant →
          </Link>
        )}
      </div>
    </div>
  );
}
