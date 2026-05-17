import { Suspense } from "react";
import { Coins, Users, TrendingUp, Settings as SettingsIcon } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatCardsRow, CardSkeleton } from "@/components/Skeletons";
import { supabaseAdmin } from "@/lib/supabase";
import { CreditDefaultsForm } from "./CreditDefaultsForm";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

type CreditSettings = {
  default_daily_limit: number;
  today_rows: number;
  today_avg_limit: number;
  today_min_limit: number;
  today_max_limit: number;
};

async function getCreditSettings(): Promise<CreditSettings> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_get_credit_settings");
  if (error || !data) {
    return {
      default_daily_limit: 100,
      today_rows: 0,
      today_avg_limit: 0,
      today_min_limit: 0,
      today_max_limit: 0,
    };
  }
  return data as CreditSettings;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration globale du dashboard."
      />

      <SectionHeader
        title="Crédits par défaut"
        subtitle="Limite quotidienne attribuée à chaque user, par défaut."
      />

      <Suspense fallback={<StatCardsRow count={4} />}>
        <CreditStats />
      </Suspense>

      <Suspense fallback={<CardSkeleton height="h-72" />}>
        <CreditFormWrapper />
      </Suspense>
    </>
  );
}

async function CreditStats() {
  const settings = await getCreditSettings();
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Défaut actuel"
        value={settings.default_daily_limit}
        hint="crédits/jour pour tout nouvel user"
        icon={Coins}
        tone="rose"
      />
      <StatCard
        label="Users actifs aujourd'hui"
        value={settings.today_rows}
        hint="ont une ligne user_credits"
        icon={Users}
        tone="violet"
      />
      <StatCard
        label="Moyenne aujourd'hui"
        value={settings.today_avg_limit}
        hint="limite moyenne actuellement"
        icon={TrendingUp}
        tone="emerald"
      />
      <StatCard
        label="Min · Max"
        value={`${settings.today_min_limit} – ${settings.today_max_limit}`}
        hint="distribution aujourd'hui"
        icon={SettingsIcon}
        tone="neutral"
      />
    </div>
  );
}

async function CreditFormWrapper() {
  const settings = await getCreditSettings();
  return (
    <article className="glass-card p-6">
      <CreditDefaultsForm currentDefault={settings.default_daily_limit} />
    </article>
  );
}
