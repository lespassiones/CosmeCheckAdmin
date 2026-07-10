import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { BetaLaunchPanel } from "./BetaLaunchPanel";

export const metadata = { title: "Bêta test" };
export const dynamic = "force-dynamic";

type BetaRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_at: string | null;
  status: string;
  source: string | null;
  created_at: string;
};

async function getStats(): Promise<{ total: number; pending: number; invited: number; feedback: number }> {
  try {
    const sb = supabaseAdmin();
    const t = () => sb.schema("cosme_check").from("beta_testers");
    const [totalRes, pendingRes, feedbackRes] = await Promise.all([
      t().select("id", { count: "exact", head: true }),
      t().select("id", { count: "exact", head: true }).is("invited_at", null),
      t().select("id", { count: "exact", head: true }).eq("status", "feedback_recu"),
    ]);
    const total = totalRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    return { total, pending, invited: total - pending, feedback: feedbackRes.count ?? 0 };
  } catch {
    return { total: 0, pending: 0, invited: 0, feedback: 0 };
  }
}

async function getRecent(): Promise<BetaRow[]> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .schema("cosme_check")
      .from("beta_testers")
      .select("email, first_name, last_name, invited_at, status, source, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data as BetaRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function BetaPage() {
  const [stats, recent] = await Promise.all([getStats(), getRecent()]);

  return (
    <>
      <PageHeader
        title="Bêta test"
        subtitle="Inscrits au programme bêta, lancement des invitations et suivi des retours."
        info="La page publique /beta collecte les emails (avec consentement). Ici tu déclenches l'envoi des invitations : chaque inscrit non encore invité reçoit son accès + le lien du formulaire de retour. Plusieurs vagues possibles."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Inscrits" value={stats.total} />
        <Stat label="En attente" value={stats.pending} accent={stats.pending > 0} />
        <Stat label="Invités" value={stats.invited} />
        <Stat label="Retours reçus" value={stats.feedback} />
      </div>

      <BetaLaunchPanel pending={stats.pending} />

      <SectionHeader title="Derniers inscrits" subtitle="25 plus récents." />
      <div className="neo-card overflow-x-auto">
        {recent.length === 0 ? (
          <p className="p-5 text-[13px] text-muted-foreground">Aucun inscrit pour le moment.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.email} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} invited={Boolean(r.invited_at)} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.source ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <article className={`neo-card p-5 ${accent ? "ring-2 ring-rose-300" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-none">{value}</p>
    </article>
  );
}

function StatusBadge({ status, invited }: { status: string; invited: boolean }) {
  if (status === "feedback_recu") {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Retour reçu</span>;
  }
  if (invited) {
    return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">Invité</span>;
  }
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">En attente</span>;
}
