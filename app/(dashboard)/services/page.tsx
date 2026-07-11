import { PageHeader } from "@/components/PageHeader";
import { listExternalServices } from "@/lib/queries/services";
import { ServicesTable } from "./ServicesTable";

export const metadata = { title: "Services annexes" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await listExternalServices();
  const monthly = services
    .filter((s) => s.billing === "paid" && s.active)
    .reduce((sum, s) => sum + (Number(s.monthly_amount_eur) || 0), 0);
  const paidCount = services.filter((s) => s.billing === "paid" && s.active).length;

  return (
    <>
      <PageHeader
        title="Services annexes"
        subtitle="Tous les prestataires externes de l'app mobile et du web. Coche l'usage, indique gratuit/payant et le montant mensuel."
        info="Récapitulatif de tes services (base, IA, paiement, emails, statistiques…). Un service « Payant » + montant + « Actif » est répercuté automatiquement dans la page Finance comme dépense mensuelle. Les modifications sont enregistrées ligne par ligne avec le bouton « Enregistrer »."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3.5 py-1.5 text-[13px] font-semibold text-violet-700 ring-1 ring-violet-200/70">
          Coût mensuel des services
          <span className="tabular-nums">{monthly.toFixed(2)} €</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground">
          {services.length} services · <span className="tabular-nums">{paidCount}</span> payant(s)
        </span>
      </div>

      <ServicesTable services={services} />

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        Astuce : passe un service en « Payant », saisis son montant mensuel puis clique
        « Enregistrer » — il apparaît aussitôt dans la page Finance (dépense mensuelle).
        Repasse-le en « Gratuit » ou décoche « Actif » pour le retirer du calcul.
      </p>
    </>
  );
}
