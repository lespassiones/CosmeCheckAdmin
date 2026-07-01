import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Search, Image as ImageIcon, Star, Calendar, FlaskConical } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsRow, TableSkeleton } from "@/components/Skeletons";
import { fetchProductsKpis, listProducts } from "@/lib/queries/catalog-products";
import { formatInt, formatRelative, cn } from "@/lib/utils";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";

export const metadata = { title: "Produits du catalogue" };
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  page?: string;
  size?: string;
  missing_inci?: string;
};

function scoreTone(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-600";
  if (score >= 75) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60";
  if (score >= 50) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60";
  if (score >= 25) return "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60";
}

export default async function CatalogProductsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const search = (params.q ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const size = Math.min(200, Math.max(10, parseInt(params.size ?? "50", 10) || 50));
  const missingInci = params.missing_inci === "1";

  const toggleMissingHref = (() => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (!missingInci) qs.set("missing_inci", "1");
    return `/catalog/products${qs.toString() ? "?" + qs.toString() : ""}`;
  })();

  // Suspense key — forces remount of async children when filters change so
  // the skeleton shows again on every filter/search/pagination navigation.
  const suspenseKey = `${search}|${page}|${size}|${missingInci ? 1 : 0}`;

  return (
    <>
      <CatalogTabs />
      <PageHeader
        title="Produits du catalogue"
        info="Vue liste brute de la table products (source d'import), distincte de la Base produits réellement servie à l'app mobile."
        subtitle={`Liste complète${search ? ` · recherche "${search}"` : ""}${missingInci ? " · sans INCI" : ""}.`}
        actions={
          <form method="GET" className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Marque ou nom de produit…"
              className="w-72 rounded-full border-0 bg-white py-2 pl-9 pr-4 text-sm shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-rose-400/40"
            />
            {missingInci && <input type="hidden" name="missing_inci" value="1" />}
          </form>
        }
      />

      <SectionHeader title="Vue d'ensemble" />
      <Suspense fallback={<StatCardsRow count={4} />}>
        <ProductsKpis />
      </Suspense>

      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader title="Liste" />
        <Link
          href={toggleMissingHref}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
            missingInci
              ? "bg-rose-500 text-white shadow-[0_4px_14px_-4px_rgba(244,63,94,0.5)]"
              : "bg-white text-foreground ring-1 ring-black/[0.06] hover:bg-rose-50 hover:text-rose-700",
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {missingInci ? "Sans INCI activé" : "Filtrer sans INCI"}
        </Link>
      </div>

      <Suspense key={suspenseKey} fallback={<TableSkeleton rows={10} cols={6} />}>
        <ProductsList
          search={search}
          page={page}
          size={size}
          missingInci={missingInci}
        />
      </Suspense>
    </>
  );
}

async function ProductsKpis() {
  const kpis = await fetchProductsKpis();
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Produits totaux" value={kpis.total} hint="dans le catalogue" icon={Package} tone="neutral" />
      <StatCard
        label="Avec image"
        value={kpis.withImage}
        hint={kpis.total > 0 ? `${Math.round((kpis.withImage / kpis.total) * 100)} %` : undefined}
        icon={ImageIcon}
        tone="violet"
      />
      <StatCard
        label="Avec score"
        value={kpis.withScore}
        hint={kpis.total > 0 ? `${Math.round((kpis.withScore / kpis.total) * 100)} %` : undefined}
        icon={Star}
        tone="amber"
      />
      <StatCard
        label="Scrappés 30 j"
        value={kpis.scrapedLast30d}
        hint="ajoutés ou rafraîchis"
        icon={Calendar}
        tone="emerald"
      />
    </div>
  );
}

async function ProductsList({
  search,
  page,
  size,
  missingInci,
}: {
  search: string;
  page: number;
  size: number;
  missingInci: boolean;
}) {
  const list = await listProducts({ search, page, size, missingInci });

  function pageHref(p: number): string {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    qs.set("page", String(p));
    if (size !== 50) qs.set("size", String(size));
    if (missingInci) qs.set("missing_inci", "1");
    return `/catalog/products?${qs.toString()}`;
  }

  if (list.rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={search || missingInci ? "Aucun résultat" : "Aucun produit"}
        description={
          search
            ? `Aucun produit ne correspond à "${search}".`
            : missingInci
              ? "Tous les produits du catalogue ont au moins un ingrédient associé."
              : "Le scraper n'a encore indexé aucun produit."
        }
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Page {list.page} · {formatInt(list.total)} résultat{list.total > 1 ? "s" : ""}
      </p>
      <article className="neo-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Image</th>
                <th className="px-5 py-3 text-left font-medium">Marque</th>
                <th className="px-5 py-3 text-left font-medium">Nom</th>
                <th className="px-5 py-3 text-left font-medium">Volume</th>
                <th className="px-5 py-3 text-right font-medium">Score</th>
                <th className="px-5 py-3 text-left font-medium">Scrappé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {list.rows.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-2.5">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-muted/40 ring-1 ring-black/[0.04]">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 object-cover"
                          unoptimized
                        />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {p.brand ?? <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {p.source_url ? (
                      <a
                        href={p.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-rose-600"
                        title={p.name ?? ""}
                      >
                        <span className="line-clamp-1 max-w-[420px]">{p.name ?? "—"}</span>
                      </a>
                    ) : (
                      <span className="line-clamp-1 max-w-[420px]">{p.name ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.volume ?? <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.score !== null ? (
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          scoreTone(p.score),
                        )}
                      >
                        {Number(p.score).toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatRelative(p.scraped_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
        <p className="text-[12px] text-muted-foreground">
          Lignes {(list.page - 1) * list.size + 1}–{(list.page - 1) * list.size + list.rows.length}{" "}
          sur {formatInt(list.total)}
        </p>
        <div className="flex items-center gap-2">
          {list.page > 1 ? (
            <Link href={pageHref(list.page - 1)} className="btn-secondary !py-2 !px-4 !text-[13px]">
              ← Précédent
            </Link>
          ) : (
            <button disabled className="btn-secondary !py-2 !px-4 !text-[13px]">
              ← Précédent
            </button>
          )}
          {list.hasNext ? (
            <Link href={pageHref(list.page + 1)} className="btn-secondary !py-2 !px-4 !text-[13px]">
              Suivant →
            </Link>
          ) : (
            <button disabled className="btn-secondary !py-2 !px-4 !text-[13px]">
              Suivant →
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
