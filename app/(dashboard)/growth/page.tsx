import Link from "next/link";
import { ScanLine, Repeat, MessageSquare, Coins, Crown, Sparkles, Users } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { InfoHint } from "@/components/InfoHint";
import { fetchGrowth } from "@/lib/queries/growth";

export const metadata = { title: "Croissance" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 0, label: "Tout" },
];

function pct(n: number, of: number): number {
  return of > 0 ? Math.round((n / of) * 100) : 0;
}

/** Funnel horizontal : une barre par étape, largeur = % des inscrits. */
function FunnelBar({
  label,
  count,
  base,
  prev,
  hint,
  color,
}: {
  label: string;
  count: number;
  base: number;
  prev: number;
  hint: string;
  color: string;
}) {
  const widthPct = Math.max(base > 0 ? (count / base) * 100 : 0, count > 0 ? 4 : 0);
  const conv = pct(count, prev);
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="font-medium text-foreground">
          {label}
          <InfoHint text={hint} />
        </span>
        <span className="text-muted-foreground">
          <b className="text-foreground">{count}</b> · {pct(count, base)}% des inscrits
          {prev !== base && prev > 0 ? ` · ${conv}% de l'étape précédente` : ""}
        </span>
      </div>
      <div className="h-9 w-full overflow-hidden rounded-xl bg-black/[0.05]">
        <div
          className={`flex h-full items-center rounded-xl px-3 text-[12px] font-semibold text-white transition-all ${color}`}
          style={{ width: `${widthPct}%` }}
        >
          {widthPct >= 12 ? count : ""}
        </div>
      </div>
    </div>
  );
}

function RetentionCard({
  label,
  retained,
  eligible,
  hint,
}: {
  label: string;
  retained: number;
  eligible: number;
  hint: string;
}) {
  const rate = pct(retained, eligible);
  return (
    <article className="neo-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        <InfoHint text={hint} />
      </p>
      <p className="mt-1 text-[28px] font-bold tracking-tight">
        {eligible === 0 ? "—" : `${rate}%`}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {eligible === 0 ? "pas encore assez de recul" : `${retained} sur ${eligible} inscrits`}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
      </div>
    </article>
  );
}

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90, 0].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const g = await fetchGrowth(days);
  const f = g.funnel;
  const periodLabel = days === 0 ? "depuis toujours" : `sur ${days} jours`;

  return (
    <>
      <PageHeader
        title="Croissance"
        subtitle="Où gagnes-tu (et où perds-tu) tes utilisateurs : funnel d'activation, rétention, usage."
        info="Toutes les données viennent de ta base en temps réel, comptes de test exclus. Le funnel suit les INSCRITS de la période choisie : combien terminent l'onboarding, font leur premier scan, créent une routine, passent premium. La rétention mesure s'ils REVIENNENT. Les stats d'usage comptent l'activité de la période, tous utilisateurs confondus."
      />

      {/* Sélecteur de période */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={p.days === 30 ? "/growth" : `/growth?days=${p.days}`}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              days === p.days
                ? "bg-rose-600 text-white"
                : "border border-black/10 bg-white text-foreground hover:bg-black/5"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <span className="ml-2 text-[12px] text-muted-foreground">
          Inscrits {periodLabel} : <b className="text-foreground">{f.signups}</b>
        </span>
      </div>

      <SectionHeader
        title="Funnel d'activation"
        info="Se lit de haut en bas : chaque barre = combien d'inscrits de la période ont atteint cette étape. Une grosse chute entre deux barres = l'endroit exact où tu perds les gens, donc l'endroit à améliorer en priorité. Exemple : si 90% terminent l'onboarding mais 40% seulement scannent, le problème est entre la fin de l'onboarding et le premier scan."
      />
      <article className="neo-card mb-8 space-y-4 p-6">
        <FunnelBar
          label="Inscrits"
          count={f.signups}
          base={f.signups}
          prev={f.signups}
          color="bg-gradient-to-r from-rose-500 to-rose-600"
          hint="Comptes créés pendant la période (comptes de test exclus)."
        />
        <FunnelBar
          label="Onboarding terminé"
          count={f.onboarding}
          base={f.signups}
          prev={f.signups}
          color="bg-gradient-to-r from-rose-500 to-fuchsia-500"
          hint="Ont fini (ou passé) le questionnaire de bienvenue et atteint l'app. S'il est bas : l'onboarding est trop long ou fait fuir."
        />
        <FunnelBar
          label="1er scan"
          count={f.first_scan}
          base={f.signups}
          prev={f.onboarding}
          color="bg-gradient-to-r from-fuchsia-500 to-violet-500"
          hint="Ont analysé au moins UN produit. C'est le moment aha : quelqu'un qui scanne a compris la valeur de l'app. S'il est bas : les gens n'arrivent pas jusqu'au scanner."
        />
        <FunnelBar
          label="Routine créée"
          count={f.routine}
          base={f.signups}
          prev={f.first_scan}
          color="bg-gradient-to-r from-violet-500 to-indigo-500"
          hint="Ont ajouté au moins un produit à leur routine. C'est le signe d'installation durable : ces utilisateurs reviennent beaucoup plus."
        />
        <FunnelBar
          label="Premium"
          count={f.premium}
          base={f.signups}
          prev={f.routine}
          color="bg-gradient-to-r from-indigo-500 to-emerald-500"
          hint="Ont pris l'abonnement (essai inclus). Le bout du funnel : le taux inscrits → premium est ton taux de conversion global."
        />
      </article>

      <SectionHeader
        title="Rétention"
        info="Est-ce qu'ils REVIENNENT ? On regarde les inscrits de la période qui ont au moins N jours d'ancienneté, et on compte ceux qui ont refait quelque chose (scan, IA...) au moins N jours après leur inscription. « — » = pas encore assez de recul (personne n'a l'ancienneté requise)."
      />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RetentionCard
          label="Reviennent après 1 jour"
          retained={g.retention.d1_retained}
          eligible={g.retention.d1_eligible}
          hint="Parmi les inscrits d'il y a au moins 1 jour : combien ont été actifs au moins 1 jour après leur inscription. Un bon score se situe autour de 25-40%."
        />
        <RetentionCard
          label="Reviennent après 7 jours"
          retained={g.retention.d7_retained}
          eligible={g.retention.d7_eligible}
          hint="Parmi les inscrits d'il y a au moins 7 jours : combien étaient encore actifs une semaine ou plus après. C'est LE chiffre qui dit si l'app « prend ». 15-25% est déjà bien."
        />
        <RetentionCard
          label="Reviennent après 30 jours"
          retained={g.retention.d30_retained}
          eligible={g.retention.d30_eligible}
          hint="Pareil à 30 jours : tes utilisateurs fidèles. 10%+ est solide pour une app grand public."
        />
      </div>

      <SectionHeader
        title={`Usage ${periodLabel}`}
        info="L'activité de la période, tous utilisateurs confondus (pas seulement les nouveaux inscrits)."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Scans" value={g.stats.scans} hint={`par ${g.stats.scanners} utilisateur(s)`} icon={ScanLine} tone="rose" />
        <StatCard
          label="Scans / utilisateur"
          value={g.stats.scanners > 0 ? (g.stats.scans / g.stats.scanners).toFixed(1) : "—"}
          hint="moyenne sur la période"
          icon={Sparkles}
          tone="violet"
        />
        <StatCard label="Ajouts en routine" value={g.stats.routine_items} hint={`${g.stats.routine_users} utilisateurs ont une routine`} icon={Repeat} tone="amber" />
        <StatCard label="Analyses de promesses" value={g.stats.promesses} hint="promesses vérifiées" icon={Users} tone="emerald" />
        <StatCard label="Messages au Beauty Advisor" value={g.stats.advisor_messages} hint="questions posées" icon={MessageSquare} tone="violet" />
        <StatCard label="Crédits consommés" value={g.stats.credits_used} hint="toutes features IA" icon={Coins} tone="amber" />
        <StatCard label="Premium (total actuel)" value={g.stats.premium_total} hint="abonnés aujourd'hui" icon={Crown} tone="rose" />
      </div>
    </>
  );
}
