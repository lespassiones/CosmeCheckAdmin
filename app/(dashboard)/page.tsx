import {
  Users,
  Activity,
  Coins,
  Sparkles,
  Package,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DailyTrendChart } from "@/components/charts/DailyTrendChart";
import { fetchOverviewKpis, fetchAiToday, fetchDailySeries } from "@/lib/queries/overview";
import { formatInt, formatUSD } from "@/lib/utils";

export const metadata = { title: "Vue d'ensemble" };

// Always fetch fresh — the admin dashboard is a real-time monitoring tool.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [kpis, ai, series] = await Promise.all([
    fetchOverviewKpis(),
    fetchAiToday(),
    fetchDailySeries(30),
  ]);

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Tout l'état de CosmetWiki en un coup d'œil."
      />

      {/* ─── KPIs (8 cards) ─────────────────────────────────────────────── */}
      <SectionHeader title="Métriques temps réel" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Utilisateurs"
          value={kpis.totalUsers}
          hint="comptes inscrits"
          delta={kpis.newSignups7d > 0 ? { value: kpis.newSignups7d } : null}
          icon={Users}
          tone="violet"
        />
        <StatCard
          label="Actifs aujourd'hui"
          value={kpis.dau}
          hint="ont lancé une action IA"
          icon={Activity}
          tone="emerald"
        />
        <StatCard
          label="Analyses aujourd'hui"
          value={kpis.analysesToday}
          hint="nouvelles analyses INCI"
          icon={Sparkles}
          tone="rose"
        />
        <StatCard
          label="Crédits consommés"
          value={kpis.creditsUsedToday}
          hint="aujourd'hui · tous users"
          icon={Coins}
          tone="amber"
        />
        <StatCard
          label="Coût IA aujourd'hui"
          value={formatUSD(ai.estimatedCostUSD, 3)}
          hint={`${formatInt(ai.totalCallsToday)} calls · ${formatInt(ai.totalTokensIn + ai.totalTokensOut)} tokens`}
          icon={TrendingUp}
          tone="rose"
        />
        <StatCard
          label="Analyses (total)"
          value={kpis.totalAnalyses}
          hint="historique cumulé"
          icon={Sparkles}
          tone="neutral"
        />
        <StatCard
          label="Produits catalogue"
          value={kpis.totalProducts}
          hint="indexés en base"
          icon={Package}
          tone="neutral"
        />
        <StatCard
          label="Erreurs 24 h"
          value={kpis.recentErrors24h}
          hint="dans error_log"
          icon={ShieldAlert}
          tone={kpis.recentErrors24h > 10 ? "rose" : "neutral"}
        />
      </div>

      {/* ─── Charts ────────────────────────────────────────────────────── */}
      <SectionHeader title="30 derniers jours" subtitle="Tendances quotidiennes" />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="neo-card p-5">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Analyses par jour
          </p>
          <p className="mb-3 text-[20px] font-semibold tabular-nums">
            {formatInt(series.reduce((s, p) => s + p.analyses, 0))}
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
              total
            </span>
          </p>
          <DailyTrendChart data={series} series="analyses" />
        </article>
        <article className="neo-card p-5">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Signups par jour
          </p>
          <p className="mb-3 text-[20px] font-semibold tabular-nums">
            {formatInt(series.reduce((s, p) => s + p.signups, 0))}
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
              nouveaux comptes
            </span>
          </p>
          <DailyTrendChart data={series} series="signups" />
        </article>
        <article className="neo-card p-5">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Coût IA cumulé ($)
          </p>
          <p className="mb-3 text-[20px] font-semibold tabular-nums">
            {formatUSD(series.reduce((s, p) => s + p.cost_usd, 0), 2)}
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
              30 j
            </span>
          </p>
          <DailyTrendChart data={series} series="cost_usd" />
        </article>
      </div>

      {/* ─── AI cost breakdown ───────────────────────────────────────────── */}
      <SectionHeader
        title="Décomposition IA aujourd'hui"
        subtitle="Coût estimé par feature ($)"
      />
      <article className="glass-card p-5">
        {ai.byFeature.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun appel IA enregistré aujourd'hui.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {ai.byFeature.map((f) => (
              <li
                key={f.feature}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-2.5 text-[13px]"
              >
                <span className="truncate font-mono text-[12px] text-muted-foreground">
                  {f.feature}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatInt(f.calls)} calls
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatInt(f.tokens_in + f.tokens_out)} tokens
                </span>
                <span className="w-20 text-right font-semibold tabular-nums">
                  {formatUSD(f.estimated_cost_usd, 4)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  );
}
