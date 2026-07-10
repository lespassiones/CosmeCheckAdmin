import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";
import { CatalogDbFilters } from "./CatalogDbFilters";
import { StubResolverPanel } from "./StubResolverPanel";
import {
  fetchCatalogStats,
  listCatalogProducts,
  type CatalogFilters,
} from "@/lib/queries/catalogDb";
import { formatInt, cn } from "@/lib/utils";

export const metadata = { title: "Base produits (catalog)" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

/** NEUTRALISÉ (parité app) : catalog.score est déjà notre score PASTILLE (plafond
 *  par position intégré). Plus de re-plafonnement (évite le double-cap). */
function capScore(score: number | null, _orange: number | null, _rouge: number | null): number | null {
  return score;
}

function scoreTone(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500";
  if (score >= 13) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60";
  if (score >= 9) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60";
  if (score >= 5) return "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60";
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-[15px] font-bold tabular-nums", tone)}>{formatInt(value)}</p>
    </>
  );
  const cls = "block rounded-xl bg-white/70 px-3 py-2 ring-1 ring-black/[0.05] transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-white hover:ring-rose-200/70")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const STATS_GRID = "mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7";

/** Squelette des stats (affiché instantanément pendant le scan ~10s). */
function StatsSkeleton() {
  return (
    <div className={STATS_GRID}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-black/[0.05]">
          <div className="h-2.5 w-16 rounded bg-slate-100" />
          <div className="mt-1.5 h-3.5 w-10 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

/** Barre de stats — async, streamée en Suspense pour ne PAS bloquer la liste. */
async function CatalogStatsBar() {
  const stats = await fetchCatalogStats();
  return (
    <div className={STATS_GRID}>
      <Stat label="Total" value={stats.total} href="/catalog/database" />
      <Stat label="Avec photo" value={stats.with_photo} href="/catalog/database?photo=with" />
      <Stat label="Sans photo" value={stats.without_photo} tone="text-rose-600" href="/catalog/database?photo=without" />
      <Stat label="Avec score" value={stats.with_score} href="/catalog/database?score=with" />
      <Stat label="Sans score" value={stats.without_score} tone="text-rose-600" href="/catalog/database?score=without" />
      <Stat label="Sans INCI" value={stats.without_inci} tone="text-rose-600" href="/catalog/database?inci=without" />
      <Stat label="Pénalisants" value={stats.penalizing} tone="text-orange-600" href="/catalog/database?penalizing=with" />
      <Stat label="Sourcé catalogue" value={stats.source_incibeauty} href="/catalog/database?source=incibeauty" />
      <Stat label="Web / notre analyse" value={stats.source_web} href="/catalog/database?source=web" />
      <Stat label="Actifs" value={stats.active} href="/catalog/database?active=active" />
      <Stat label="Inactifs" value={stats.inactive} tone="text-rose-600" href="/catalog/database?active=inactive" />
      <Stat label="Code-barre seul" value={stats.only_barcode} tone="text-amber-600" href="/catalog/database?only_barcode=1" />
    </div>
  );
}

export default async function CatalogDatabasePage({ searchParams }: { searchParams: SP }) {
  const sp = (await searchParams) ?? {};
  const one = (v: string | undefined) => (v && v.length ? v : undefined);

  const filters: CatalogFilters = {
    q: one(sp.q),
    photo: one(sp.photo) as CatalogFilters["photo"],
    score: one(sp.score) as CatalogFilters["score"],
    inci: one(sp.inci) as CatalogFilters["inci"],
    source: one(sp.source) as CatalogFilters["source"],
    penalizing: one(sp.penalizing) as CatalogFilters["penalizing"],
    active: one(sp.active) as CatalogFilters["active"],
    onlyBarcode: sp.only_barcode === "1",
    category: one(sp.category),
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
    size: 50,
  };

  // On n'attend QUE la liste (rapide ~70ms). Les stats (scan ~10s) sont streamées
  // séparément en Suspense → la liste s'affiche immédiatement.
  const list = await listCatalogProducts(filters);

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/catalog/database${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Base produits"
        subtitle="La vraie base servie à l'app mobile (cosme_check.catalog). Filtre, inspecte, ouvre un produit."
        info="La vraie base servie à l'app mobile (cosme_check.catalog, ~490k produits avec score et INCI). Filtre, inspecte, ouvre un produit."
      />
      <CatalogTabs />

      {/* Stats — streamées (le scan ~10s ne bloque PAS l'affichage de la liste). */}
      <Suspense fallback={<StatsSkeleton />}>
        <CatalogStatsBar />
      </Suspense>

      <CatalogDbFilters />

      {/* Résolveur GPT — visible quand on filtre les « code-barre seul ». */}
      {filters.onlyBarcode && list.rows.length > 0 && (
        <StubResolverPanel eans={list.rows.map((r) => r.ean)} />
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/[0.05]">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-black/[0.06] text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Produit</th>
              <th className="px-3 py-2.5">Catégorie</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                {list.timedOut
                  ? "Recherche trop longue (timeout). Affine les filtres ou précise la recherche."
                  : "Aucun produit pour ces filtres."}
              </td></tr>
            ) : (
              list.rows.map((p) => (
                <tr key={p.ean} className="border-b border-black/[0.04] last:border-0 hover:bg-white">
                  <td className="px-3 py-2.5">
                    <Link href={`/catalog/database/${encodeURIComponent(p.ean)}`} className="flex items-center gap-3">
                      {p.image_url ? (
                        <Image src={p.image_url} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover ring-1 ring-black/[0.05]" unoptimized />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImageOff className="h-4 w-4" /></span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{p.name ?? "—"}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.brand ?? "—"} · {p.ean}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                      p.source_url ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600")}>
                      {p.source_url ? "Web" : "Catalogue"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(() => {
                      const capped = capScore(p.score, p.count_orange, p.count_rouge);
                      const isCapped = p.score !== null && capped !== null && capped < p.score;
                      return (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {isCapped && (
                            <span className="text-[10px] text-orange-500" title={`Plafonné (blocus) · ${p.count_orange ?? 0} orange / ${p.count_rouge ?? 0} rouge · score brut ${p.score?.toFixed(1)}`}>
                              ⚠
                            </span>
                          )}
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", scoreTone(capped))}>
                            {capped === null ? "—" : capped.toFixed(1)}
                          </span>
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — 50/page, numéros autour de la page courante + Suivant. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">50 par page · page {list.page}</span>
        <div className="flex items-center gap-1.5">
          {list.page > 1 && (
            <Link href={pageHref(list.page - 1)} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-black/[0.08] hover:bg-slate-50">← Précédent</Link>
          )}
          {Array.from({ length: 5 }, (_, i) => list.page - 2 + i)
            .filter((p) => p >= 1 && (p <= list.page || list.hasMore))
            .map((p) => (
              <Link
                key={p}
                href={pageHref(p)}
                aria-current={p === list.page ? "page" : undefined}
                className={cn(
                  "min-w-[34px] rounded-lg px-2.5 py-1.5 text-center ring-1",
                  p === list.page
                    ? "bg-rose-600 text-white ring-rose-600"
                    : "bg-white ring-black/[0.08] hover:bg-slate-50",
                )}
              >
                {p}
              </Link>
            ))}
          {list.hasMore && (
            <Link href={pageHref(list.page + 1)} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-black/[0.08] hover:bg-slate-50">Suivant →</Link>
          )}
        </div>
      </div>
    </div>
  );
}
