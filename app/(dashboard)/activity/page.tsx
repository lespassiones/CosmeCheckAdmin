import { Suspense } from "react";
import { Activity, Sparkles, ScanLine, ShieldCheck, MessageCircle } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { ActivityTrendChart } from "@/components/charts/ActivityTrendChart";
import { CategoryPie } from "@/components/charts/CategoryPie";
import {
  StatCardsRow,
  ChartCardSkeleton,
  TableSkeleton,
  ListSkeleton,
  CardSkeleton,
} from "@/components/Skeletons";
import {
  fetchActivityKpis,
  fetchActivityTrend,
  fetchRecentAnalyses,
  fetchActivityDistributions,
  fetchCoherenceVerdictsToday,
} from "@/lib/queries/activity";
import { formatInt, formatRelative, cn } from "@/lib/utils";

export const metadata = { title: "Activité" };
export const dynamic = "force-dynamic";

function scoreTone(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500";
  if (score >= 14) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60";
  if (score >= 10) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60";
}

function scoreDot(score: number | null): string {
  if (score === null) return "bg-slate-300";
  if (score >= 14) return "bg-emerald-500";
  if (score >= 10) return "bg-amber-500";
  return "bg-rose-500";
}

const VERDICT_META: Record<
  "tenu" | "partiel" | "non_tenu" | "hors_sujet",
  { label: string; pill: string; bar: string }
> = {
  tenu: { label: "Tenu", pill: "pill-emerald", bar: "bg-emerald-500" },
  partiel: { label: "Partiel", pill: "pill-amber", bar: "bg-amber-500" },
  non_tenu: { label: "Non tenu", pill: "pill-rose-tag", bar: "bg-rose-500" },
  hors_sujet: { label: "Hors sujet", pill: "pill", bar: "bg-slate-400" },
};

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        title="Activité"
        subtitle="Vue temps réel des analyses, tous utilisateurs confondus."
      />

      <SectionHeader title="Aujourd'hui" subtitle="Activité produite par tous les utilisateurs" />
      <Suspense fallback={<StatCardsRow count={4} />}>
        <ActivityKpis />
      </Suspense>

      <SectionHeader title="30 derniers jours" subtitle="Tendances quotidiennes" />
      <Suspense fallback={<ChartCardSkeleton rows={2} />}>
        <ActivityTrends />
      </Suspense>

      <SectionHeader title="Analyses récentes" subtitle="Dernières analyses cross-user" />
      <Suspense fallback={<TableSkeleton rows={8} cols={5} />}>
        <RecentAnalyses />
      </Suspense>

      <SectionHeader title="Tendances de scan" subtitle="Cumul historique" />
      <Suspense
        fallback={
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ListSkeleton rows={6} />
            <ListSkeleton rows={6} />
            <ListSkeleton rows={6} />
          </div>
        }
      >
        <Distributions />
      </Suspense>

      <SectionHeader title="Verdicts cohérence — aujourd'hui" />
      <Suspense fallback={<CardSkeleton height="h-32" />}>
        <CoherenceVerdicts />
      </Suspense>
    </>
  );
}

async function ActivityKpis() {
  const kpis = await fetchActivityKpis();
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Analyses aujourd'hui"
        value={kpis.analysesToday}
        hint="nouvelles analyses INCI"
        icon={Sparkles}
        tone="rose"
      />
      <StatCard
        label="Scans code-barres aujourd'hui"
        value={kpis.barcodeScansToday}
        hint="codes-barres scannés"
        icon={ScanLine}
        tone="violet"
      />
      <StatCard
        label="Cohérence aujourd'hui"
        value={kpis.coherenceToday}
        hint="analyses promesse/INCI"
        icon={ShieldCheck}
        tone="emerald"
      />
      <StatCard
        label="Messages advisor aujourd'hui"
        value={kpis.advisorMessagesToday}
        hint="synthèses Beauty Advisor"
        icon={MessageCircle}
        tone="amber"
      />
    </div>
  );
}

async function ActivityTrends() {
  const trend = await fetchActivityTrend(30);
  const totalAnalyses30d = trend.reduce((s, p) => s + p.analyses, 0);
  const totalBarcode30d = trend.reduce((s, p) => s + p.barcode, 0);
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <article className="neo-card p-5">
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Analyses par jour
        </p>
        <p className="mb-3 text-[20px] font-semibold tabular-nums">
          {formatInt(totalAnalyses30d)}
          <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
            sur 30 j
          </span>
        </p>
        <ActivityTrendChart data={trend} series="analyses" />
      </article>
      <article className="neo-card p-5">
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Scans code-barres par jour
        </p>
        <p className="mb-3 text-[20px] font-semibold tabular-nums">
          {formatInt(totalBarcode30d)}
          <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
            sur 30 j
          </span>
        </p>
        <ActivityTrendChart data={trend} series="barcode" />
      </article>
    </div>
  );
}

async function RecentAnalyses() {
  const recent = await fetchRecentAnalyses(30);

  if (recent.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState
          icon={Activity}
          title="Aucune analyse récente"
          description="Dès qu'un utilisateur lance une analyse INCI, elle apparaîtra ici."
        />
      </div>
    );
  }

  return (
    <article className="neo-card mb-8 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Utilisateur</th>
              <th className="px-5 py-3 text-left font-medium">Produit</th>
              <th className="px-5 py-3 text-right font-medium">Score</th>
              <th className="px-5 py-3 text-left font-medium">Catégorie</th>
              <th className="px-5 py-3 text-left font-medium">Quand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {recent.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className="px-5 py-3">
                  <span className="truncate font-medium">{r.user_email}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {r.product_label ?? (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums",
                      scoreTone(r.score),
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", scoreDot(r.score))} />
                    {r.score === null ? "—" : r.score.toFixed(1)}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {r.category ?? <span className="text-muted-foreground/60">—</span>}
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {formatRelative(r.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

async function Distributions() {
  const distributions = await fetchActivityDistributions();
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <article className="neo-card p-5">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          Top 10 marques
        </p>
        {distributions.topBrands.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune marque scannée.
          </p>
        ) : (
          <ul className="space-y-2">
            {distributions.topBrands.map((b, i) => (
              <li
                key={b.key}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate">{b.key}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatInt(b.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="neo-card p-5">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          Top 10 produits
        </p>
        {distributions.topProducts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun produit scanné.
          </p>
        ) : (
          <ul className="space-y-2">
            {distributions.topProducts.map((p, i) => (
              <li
                key={p.key}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate">{p.key}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatInt(p.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="neo-card p-5">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          Catégories
        </p>
        {distributions.byCategory.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune catégorie.
          </p>
        ) : (
          <>
            <CategoryPie data={distributions.byCategory} />
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {distributions.byCategory.slice(0, 6).map((c) => (
                <li
                  key={c.key}
                  className="flex items-center justify-between gap-2 text-[12px]"
                >
                  <span className="truncate text-muted-foreground">{c.key}</span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatInt(c.count)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </div>
  );
}

async function CoherenceVerdicts() {
  const verdicts = await fetchCoherenceVerdictsToday();
  return (
    <article className="glass-card p-5">
      {verdicts.total === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Aucune analyse de cohérence aujourd'hui.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(Object.keys(VERDICT_META) as Array<keyof typeof VERDICT_META>).map((k) => (
              <span key={k} className={VERDICT_META[k].pill}>
                {VERDICT_META[k].label}
                <span className="tabular-nums">{formatInt(verdicts.counts[k])}</span>
              </span>
            ))}
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {(Object.keys(VERDICT_META) as Array<keyof typeof VERDICT_META>).map((k) => {
              const pct = verdicts.total > 0 ? (verdicts.counts[k] / verdicts.total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <span
                  key={k}
                  className={cn("h-full", VERDICT_META[k].bar)}
                  style={{ width: `${pct}%` }}
                  aria-label={`${VERDICT_META[k].label} ${pct.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
            {(Object.keys(VERDICT_META) as Array<keyof typeof VERDICT_META>).map((k) => {
              const pct = verdicts.total > 0 ? (verdicts.counts[k] / verdicts.total) * 100 : 0;
              return (
                <div key={k} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", VERDICT_META[k].bar)} />
                    <span className="text-muted-foreground">{VERDICT_META[k].label}</span>
                  </span>
                  <span className="tabular-nums font-medium">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
