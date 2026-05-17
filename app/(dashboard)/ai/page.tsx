import {
  Coins,
  Wallet,
  CalendarRange,
  Sparkles,
  Database,
  Globe,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DailyTrendChart } from "@/components/charts/DailyTrendChart";
import {
  fetchAiKpis,
  fetchAiDailyCostSeries,
  fetchAiBreakdowns,
  fetchAiCacheStats,
  fetchProductInciCacheStats,
} from "@/lib/queries/ai";
import { formatInt, formatUSD, formatRelative } from "@/lib/utils";
import { PurgeCacheButton } from "./PurgeCacheButton";

export const metadata = { title: "Coûts IA & Cache" };

// Real-time admin monitoring — never serve stale data.
export const dynamic = "force-dynamic";

/** "12.3 %" — percentage with 1 decimal, French style. */
function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)} %`;
}

export default async function AiPage() {
  const [kpis, series, breakdowns, aiCache, inciCache] = await Promise.all([
    fetchAiKpis(),
    fetchAiDailyCostSeries(30),
    fetchAiBreakdowns(30),
    fetchAiCacheStats(),
    fetchProductInciCacheStats(),
  ]);

  const cumulativeCost = series.reduce((s, p) => s + p.cost_usd, 0);

  return (
    <>
      <PageHeader
        title="Coûts IA & Cache"
        subtitle="Tokens consommés, dépenses estimées, efficacité du cache."
      />

      {/* ─── KPIs (4 cards) ──────────────────────────────────────────────── */}
      <SectionHeader title="Indicateurs clés" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Coût aujourd'hui"
          value={formatUSD(kpis.costTodayUSD, 3)}
          hint="estimé · gpt-4o-mini"
          icon={Coins}
          tone="rose"
        />
        <StatCard
          label="Coût 7 derniers jours"
          value={formatUSD(kpis.cost7dUSD, 3)}
          hint="cumul 7 j"
          icon={Wallet}
          tone="amber"
        />
        <StatCard
          label="Coût 30 derniers jours"
          value={formatUSD(kpis.cost30dUSD, 3)}
          hint="cumul 30 j"
          icon={CalendarRange}
          tone="violet"
        />
        <StatCard
          label="Cache hit rate"
          value={formatPercent(kpis.cacheHitRate)}
          hint="hits / (hits + calls)"
          icon={Sparkles}
          tone="emerald"
        />
      </div>

      {/* ─── Daily cost chart (full width) ──────────────────────────────── */}
      <SectionHeader
        title="Coût IA quotidien"
        subtitle="30 derniers jours · estimation en USD"
      />
      <article className="neo-card mb-8 p-5">
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Coût IA cumulé
        </p>
        <p className="mb-3 text-[20px] font-semibold tabular-nums">
          {formatUSD(cumulativeCost, 2)}
          <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
            30 j
          </span>
        </p>
        <DailyTrendChart data={series} series="cost_usd" />
      </article>

      {/* ─── Breakdown by feature ────────────────────────────────────────── */}
      <SectionHeader
        title="Décomposition par feature"
        subtitle="30 derniers jours · trié par coût"
      />
      <article className="glass-card mb-8 p-5">
        {breakdowns.byFeature.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun appel IA enregistré sur la période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-3">Feature</th>
                  <th className="pb-3 px-3 text-right">Calls</th>
                  <th className="pb-3 px-3 text-right">Tokens in</th>
                  <th className="pb-3 px-3 text-right">Tokens out</th>
                  <th className="pb-3 px-3 text-right">Latence p50</th>
                  <th className="pb-3 px-3 text-right">Latence p95</th>
                  <th className="pb-3 pl-3 text-right">Coût $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {breakdowns.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td className="py-2.5 pr-3 font-mono text-[12px] text-muted-foreground">
                      {f.feature}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatInt(f.calls)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatInt(f.tokens_in)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatInt(f.tokens_out)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatInt(f.latency_p50_ms)} ms
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatInt(f.latency_p95_ms)} ms
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {formatUSD(f.cost_usd, 4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* ─── Breakdown by provider ───────────────────────────────────────── */}
      <SectionHeader
        title="Décomposition par provider"
        subtitle="30 derniers jours"
      />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {breakdowns.byProvider.length === 0 ? (
          <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
            Aucun provider IA actif sur la période.
          </p>
        ) : (
          breakdowns.byProvider.map((p) => (
            <article key={p.provider} className="neo-card-sm p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="pill-rose-tag">{p.provider}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatInt(p.calls)} calls
                </span>
              </div>
              <p className="mt-3 text-[20px] font-semibold tabular-nums">
                {formatUSD(p.cost_usd, 3)}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
                {formatInt(p.tokens_in)} in · {formatInt(p.tokens_out)} out
              </p>
            </article>
          ))
        )}
      </div>

      {/* ─── AI cache section ────────────────────────────────────────────── */}
      <SectionHeader
        title="Cache IA — ai_cache"
        subtitle="Résultats LLM mis en cache par cache_key"
        actions={<PurgeCacheButton target="ai_cache" />}
      />
      <article className="glass-card mb-8 p-5">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="neo-card-sm p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Entrées
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums">
              {formatInt(aiCache.totalEntries)}
            </p>
          </div>
          <div className="neo-card-sm p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Hits cumulés
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums">
              {formatInt(aiCache.totalHits)}
            </p>
          </div>
          <div className="neo-card-sm p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Hit rate
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums">
              {formatPercent(aiCache.hitRate)}
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          Top 20 entrées les plus utilisées
        </div>
        {aiCache.topEntries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Cache vide.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {aiCache.topEntries.map((e) => (
              <li
                key={e.cache_key}
                className="grid grid-cols-[1fr_auto_auto] gap-4 py-2.5 text-[13px]"
              >
                <span className="truncate font-mono text-[12px] text-muted-foreground">
                  {e.cache_key}
                </span>
                <span className="pill-emerald tabular-nums">
                  {formatInt(e.hits)} hits
                </span>
                <span className="w-28 text-right text-[12px] tabular-nums text-muted-foreground">
                  {formatRelative(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* ─── product_inci_cache section ──────────────────────────────────── */}
      <SectionHeader
        title="Cache web-search — product_inci_cache"
        subtitle="Résultats de recherche produit mis en cache"
        actions={<PurgeCacheButton target="product_inci_cache" />}
      />
      <article className="glass-card mb-8 p-5">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="neo-card-sm p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Entrées
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums">
              {formatInt(inciCache.totalEntries)}
            </p>
          </div>
          <div className="neo-card-sm p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Sources distinctes
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums">
              {formatInt(inciCache.bySource.length)}
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Répartition par source
        </div>
        {inciCache.bySource.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Cache vide.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {inciCache.bySource.map((s) => {
              const pct = inciCache.totalEntries === 0
                ? 0
                : s.count / inciCache.totalEntries;
              return (
                <li
                  key={s.source}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 text-[13px]"
                >
                  <span className="truncate font-mono text-[12px] text-muted-foreground">
                    {s.source}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatInt(s.count)}
                  </span>
                  <span className="w-16 text-right text-[12px] font-semibold tabular-nums">
                    {formatPercent(pct)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </>
  );
}
