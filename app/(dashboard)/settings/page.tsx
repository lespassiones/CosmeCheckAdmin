import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchAiKpis } from "@/lib/queries/ai";
import { AppConfigForm, type AppConfig } from "./AppConfigForm";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

const DEFAULTS: AppConfig = {
  signup_default_tier: "free",
  signups_open: true,
  flag_deep_search: true,
  flag_suggestions: true,
  flag_advisor: true,
  flag_public_share: true,
  ai_cost_alert_daily_usd: null,
  ai_cost_alert_monthly_usd: null,
  maintenance_mode: false,
  maintenance_message: null,
};

async function getConfig(): Promise<AppConfig> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.rpc("cosme_check_admin_get_app_config");
    return { ...DEFAULTS, ...((data as Partial<AppConfig> | null) ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

export default async function SettingsPage() {
  const [config, kpis] = await Promise.all([getConfig(), fetchAiKpis()]);

  const dailyOver =
    config.ai_cost_alert_daily_usd != null && kpis.costTodayUSD > config.ai_cost_alert_daily_usd;
  const monthlyOver =
    config.ai_cost_alert_monthly_usd != null && kpis.cost30dUSD > config.ai_cost_alert_monthly_usd;

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration globale de l'app (inscription, fonctionnalités, coûts, maintenance)."
        info="Configuration globale lue au runtime par le mobile ET le web : ouverture des inscriptions, activation des features (flags), coût en crédits par feature, mode maintenance."
      />

      <SectionHeader title="Coûts IA — état des alertes" subtitle="Dépense estimée vs seuils configurés ci-dessous." />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CostStat label="Aujourd'hui" value={kpis.costTodayUSD} threshold={config.ai_cost_alert_daily_usd} over={dailyOver} />
        <CostStat label="30 derniers jours" value={kpis.cost30dUSD} threshold={config.ai_cost_alert_monthly_usd} over={monthlyOver} />
      </div>

      <AppConfigForm initial={config} />
    </>
  );
}

function CostStat({
  label,
  value,
  threshold,
  over,
}: {
  label: string;
  value: number;
  threshold: number | null;
  over: boolean;
}) {
  return (
    <article className={`neo-card p-5 ${over ? "ring-2 ring-rose-300" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-none">${value.toFixed(2)}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {threshold != null ? (
          over ? (
            <span className="font-medium text-rose-600">⚠ Dépasse le seuil de ${threshold}</span>
          ) : (
            <>Seuil : ${threshold}</>
          )
        ) : (
          "Aucun seuil défini"
        )}
      </p>
    </article>
  );
}
