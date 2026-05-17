import { CreditCard, TrendingUp, Users, AlertTriangle, ArrowUpRight } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabaseAdmin } from "@/lib/supabase";
import { formatEUR, formatInt } from "@/lib/utils";

export const metadata = { title: "Abonnements" };
export const dynamic = "force-dynamic";

async function getBillingKpis() {
  const sb = supabaseAdmin();
  const { count: premiumCount } = await sb
    .schema("cosme_check")
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("tier", "premium");
  return {
    mrr: 0, // Stripe not connected yet
    premiumUsers: premiumCount ?? 0,
    churn30d: 0,
    paymentFailures: 0,
  };
}

export default async function BillingPage() {
  const kpis = await getBillingKpis();

  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle="Suivi des conversions Premium et du chiffre d'affaires récurrent."
        actions={
          <button
            type="button"
            disabled
            className="btn-secondary cursor-not-allowed opacity-60"
            title="Connectez Stripe pour activer le tracking complet"
          >
            <ArrowUpRight className="h-4 w-4" />
            Connecter Stripe
          </button>
        }
      />

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="MRR"
          value={formatEUR(kpis.mrr)}
          hint="revenu mensuel récurrent"
          icon={TrendingUp}
          tone="emerald"
        />
        <StatCard
          label="Users Premium"
          value={kpis.premiumUsers}
          hint="abonnés actifs"
          icon={Users}
          tone="amber"
        />
        <StatCard
          label="Churn 30 j"
          value={formatInt(kpis.churn30d) + " %"}
          hint="taux de désabonnement"
          icon={AlertTriangle}
          tone="rose"
        />
        <StatCard
          label="Échecs paiement"
          value={kpis.paymentFailures}
          hint="à recouvrer"
          icon={CreditCard}
          tone="neutral"
        />
      </div>

      {/* Setup hint */}
      <article className="glass-card-rose p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-rose-600 ring-1 ring-rose-200/60"
          >
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight">
              Stripe pas encore connecté
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cet onglet activera le suivi MRR, churn, échecs de paiement et
              cohortes une fois ton compte Stripe lié. Pour l'instant, seuls les
              comptes avec <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[12px]">tier='premium'</code> sont
              comptés dans la carte ci-dessus.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-muted-foreground">
              <li>Ajouter <code className="font-mono">STRIPE_SECRET_KEY</code> et <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> dans le <code className="font-mono">.env</code></li>
              <li>Créer la table <code className="font-mono">cosme_check.subscriptions</code> qui mirror Stripe</li>
              <li>Brancher le webhook sur <code className="font-mono">/api/stripe/webhook</code></li>
            </ul>
          </div>
        </div>
      </article>

      <SectionHeader title="Cohortes premium" />
      <article className="neo-card flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Tableau cohortes disponible quand Stripe sera connecté.
        </p>
      </article>
    </>
  );
}
