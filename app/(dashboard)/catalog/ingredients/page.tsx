import { Suspense } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Search,
  Sparkles,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import {
  Shimmer,
  StatCardsRow,
  TableSkeleton,
} from "@/components/Skeletons";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";
import {
  fetchIngredientsKpis,
  listIngredients,
  primaryFunction,
  type IngredientView,
} from "@/lib/queries/catalog-ingredients";
import { formatInt, cn } from "@/lib/utils";
import { BatchExplainButton } from "./BatchExplainButton";

export const metadata = { title: "Ingrédients" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; view?: string };

const VIEWS: Array<{ key: IngredientView; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "missing_expl", label: "Sans explication AI" },
  { key: "missing_details", label: "Sans details scrapés" },
];

const COLOR_TONE: Record<string, string> = {
  Vert: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  Jaune: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200/60",
  Orange: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
  Rouge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
};

function parseView(raw: string | undefined): IngredientView {
  if (raw === "missing_expl" || raw === "missing_details") return raw;
  return "all";
}

export default async function CatalogIngredientsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const search = (params.q ?? "").trim();
  const view = parseView(params.view);

  function tabHref(v: IngredientView): string {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (v !== "all") qs.set("view", v);
    return `/catalog/ingredients${qs.toString() ? "?" + qs.toString() : ""}`;
  }

  const tableKey = `${search}|${view}`;

  return (
    <>
      <CatalogTabs />
      <PageHeader
        title="Ingrédients"
        subtitle="Base INCI · couleurs, explications AI, prévalence."
        info="Base INCI : couleur de tolérance (vert à rouge), explication grand public générée par IA, et prévalence dans le catalogue."
        actions={
          <div className="flex items-center gap-2">
            <form method="GET" className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={search}
                placeholder="Nom ou slug…"
                className="w-64 rounded-full border-0 bg-white py-2 pl-9 pr-4 text-sm shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-rose-400/40"
              />
              {view !== "all" && <input type="hidden" name="view" value={view} />}
            </form>
            <Suspense fallback={<Shimmer className="h-9 w-32 rounded-full" />}>
              <BatchExplainTrigger />
            </Suspense>
          </div>
        }
      />

      <SectionHeader title="Vue d'ensemble" />
      <Suspense
        fallback={
          <>
            <StatCardsRow count={4} />
            <Shimmer className="mb-3 h-4 w-56" />
            <StatCardsRow count={4} />
          </>
        }
      >
        <IngredientsKpis />
      </Suspense>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <Link
              key={v.key}
              href={tabHref(v.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-rose-500 text-white shadow-[0_4px_14px_-4px_rgba(244,63,94,0.5)]"
                  : "bg-white text-foreground ring-1 ring-black/[0.06] hover:bg-rose-50 hover:text-rose-700",
              )}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      <Suspense key={tableKey} fallback={<TableSkeleton rows={10} cols={7} />}>
        <IngredientsTable search={search} view={view} />
      </Suspense>
    </>
  );
}

async function BatchExplainTrigger() {
  const kpis = await fetchIngredientsKpis();
  return <BatchExplainButton missing={kpis.withoutExplanation} />;
}

async function IngredientsKpis() {
  const kpis = await fetchIngredientsKpis();
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ingrédients totaux" value={kpis.total} icon={FlaskConical} tone="neutral" />
        <StatCard
          label="Avec explication AI"
          value={kpis.withExplanation}
          hint={kpis.total > 0 ? `${Math.round((kpis.withExplanation / kpis.total) * 100)} %` : undefined}
          icon={Sparkles}
          tone="emerald"
        />
        <StatCard
          label="Sans explication"
          value={kpis.withoutExplanation}
          hint="à générer"
          icon={XCircle}
          tone={kpis.withoutExplanation > 0 ? "rose" : "neutral"}
        />
        <StatCard
          label="Details scrapés"
          value={kpis.detailsScraped}
          hint={kpis.total > 0 ? `${Math.round((kpis.detailsScraped / kpis.total) * 100)} %` : undefined}
          icon={Database}
          tone="violet"
        />
      </div>

      <SectionHeader title="Répartition par couleur INCI" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(kpis.byColor) as Array<keyof typeof kpis.byColor>).map((c) => (
          <article key={c} className={cn("neo-card p-4")}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {c}
              </p>
              <span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 rounded-full ring-2 ring-white",
                  c === "Vert" && "bg-emerald-500",
                  c === "Jaune" && "bg-yellow-400",
                  c === "Orange" && "bg-orange-500",
                  c === "Rouge" && "bg-rose-500",
                )}
              />
            </div>
            <p className="mt-2 text-[24px] font-semibold tabular-nums leading-none">
              {formatInt(kpis.byColor[c])}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kpis.total > 0 ? `${Math.round((kpis.byColor[c] / kpis.total) * 100)} %` : "—"}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

async function IngredientsTable({
  search,
  view,
}: {
  search: string;
  view: IngredientView;
}) {
  const rows = await listIngredients({ search, view, limit: 200 });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={search ? "Aucun résultat" : "Aucun ingrédient"}
        description={
          search
            ? `Aucun ingrédient ne correspond à "${search}".`
            : "Aucun ingrédient ne correspond aux filtres actifs."
        }
      />
    );
  }

  return (
    <article className="neo-card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Nom</th>
              <th className="px-5 py-3 text-left font-medium">Couleur</th>
              <th className="px-5 py-3 text-left font-medium">CAS</th>
              <th className="px-5 py-3 text-left font-medium">Fonction principale</th>
              <th className="px-5 py-3 text-right font-medium">Prévalence</th>
              <th className="px-5 py-3 text-center font-medium">Explication</th>
              <th className="px-5 py-3 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {rows.map((r) => {
              const fn = primaryFunction(r.functions);
              return (
                <tr key={r.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">
                    <span className="line-clamp-1 max-w-[260px]">
                      {r.name ?? r.slug ?? `#${r.inci_id}`}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.color_rating ? (
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          COLOR_TONE[r.color_rating],
                        )}
                      >
                        {r.color_rating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-[11.5px] text-muted-foreground">
                    {r.cas_number ?? <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {fn ? (
                      <span className="line-clamp-1 max-w-[220px]">{fn}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {r.prevalence_pct !== null && r.prevalence_pct !== undefined
                      ? `${Number(r.prevalence_pct).toFixed(1)} %`
                      : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {r.has_explanation ? (
                      <span className="pill-emerald">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </span>
                    ) : (
                      <span className="pill-rose-tag">
                        <XCircle className="h-3 w-3" />
                        Manquante
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.source_url ? (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-rose-600"
                      >
                        INCI <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
