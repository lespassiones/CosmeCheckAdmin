import { CreditCard, Users, Hourglass, Store } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { fetchBillingOverview } from "@/lib/queries/billing";

export const metadata = { title: "Abonnements" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

const STORE_LABEL: Record<string, string> = {
  play_store: "Google Play",
  app_store: "App Store",
  stripe: "Stripe",
  promotional: "Promo",
};

export default async function BillingPage() {
  const ov = await fetchBillingOverview();

  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle="Abonnés premium réels : liste depuis la base (webhook RevenueCat), détail plan/essai depuis RevenueCat."
        info="La liste vient de user_profiles (tier premium), tenue à jour en temps réel par le webhook RevenueCat (achat, renouvellement, annulation). Le détail (mensuel/annuel, essai en cours, échéance, store) est lu en direct chez RevenueCat pour chaque abonné. « Essai » = période d'essai 3 jours en cours : la conversion en paiement se fait à l'échéance si l'utilisateur n'annule pas."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Abonnés premium" value={ov.premiumCount} hint="tier premium en base" icon={Users} tone="rose" />
        <StatCard label="En essai" value={ov.trialCount} hint="essai 3 jours en cours" icon={Hourglass} tone="amber" />
        <StatCard
          label="Payants"
          value={ov.premiumCount - ov.trialCount}
          hint="hors periode d'essai"
          icon={CreditCard}
          tone="emerald"
        />
        <StatCard
          label="Canal"
          value={ov.rcConfigured ? "RevenueCat" : "Base seule"}
          hint={ov.rcConfigured ? "détail lu en direct" : "clé RC absente (détail masqué)"}
          icon={Store}
          tone="violet"
        />
      </div>

      <SectionHeader
        title="Abonnés"
        info="Un abonné par ligne. Plan = mensuel ou annuel. Statut = essai (3 j gratuits en cours) ou actif (payant). Échéance = prochaine facturation ou fin d'essai. Sandbox = achat de test (ne compte pas comme revenu)."
      />
      <article className="neo-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Utilisateur</th>
                <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
                <th className="px-4 py-2.5 text-left font-medium">Store</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {ov.subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun abonné premium pour le moment.
                  </td>
                </tr>
              ) : (
                ov.subscribers.map((s) => (
                  <tr key={s.userId} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{s.email ?? s.userId}</p>
                      {s.firstName ? (
                        <p className="text-[12px] text-muted-foreground">{s.firstName}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.rc?.plan ? (
                        <span className="pill">{s.rc.plan}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.rc ? (
                        <span className={s.rc.isTrial ? "pill-amber" : "pill-emerald"}>
                          {s.rc.isTrial ? "essai" : "actif"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {s.rc?.isSandbox ? (
                        <span className="pill ml-1 text-[10px] uppercase">sandbox</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(s.rc?.expiresAt ?? null)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.rc?.store ? STORE_LABEL[s.rc.store] ?? s.rc.store : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="mt-8">
        <SectionHeader
          title="Stripe (web)"
          info="Les abonnements pris sur le SITE passent par Stripe ; ceux pris dans l'APP passent par Google Play (RevenueCat). Le suivi Stripe détaillé (MRR, churn, échecs de paiement) sera ajouté quand des ventes web existeront."
        />
        <article className="neo-card p-5 text-[13px] text-muted-foreground">
          Aucune vente Stripe pour le moment. Les abonnements actuels viennent du Play Store (tableau ci-dessus).
        </article>
      </div>
    </>
  );
}
