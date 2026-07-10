import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { BetaLaunchPanel } from "./BetaLaunchPanel";
import { BetaTestersTable, type BetaTesterView, type AnswerItem } from "./BetaTestersTable";

export const metadata = { title: "Bêta test" };
export const dynamic = "force-dynamic";

type TesterRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_at: string | null;
  status: string;
  source: string | null;
  created_at: string;
  intake: unknown;
};

/** Transforme un objet jsonb { i3: {q,a}, i1: {q,a} } en liste ordonnée par
 *  numéro de clé, en ne gardant que les réponses non vides. */
function toAnswerList(obj: unknown): AnswerItem[] {
  if (!obj || typeof obj !== "object") return [];
  const num = (k: string) => Number((k.match(/\d+/) ?? ["0"])[0]);
  return Object.entries(obj as Record<string, { q?: unknown; a?: unknown }>)
    .sort((a, b) => num(a[0]) - num(b[0]))
    .map(([, v]) => ({ q: String(v?.q ?? ""), a: String(v?.a ?? "") }))
    .filter((x) => x.a.trim().length > 0);
}

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

async function getRecent(): Promise<BetaTesterView[]> {
  try {
    const sb = supabaseAdmin();
    const { data: testers } = await sb
      .schema("cosme_check")
      .from("beta_testers")
      .select("id, email, first_name, last_name, invited_at, status, source, created_at, intake")
      .order("created_at", { ascending: false })
      .limit(25);

    const rows = (testers as TesterRow[] | null) ?? [];
    const ids = rows.map((r) => r.id);

    const feedbackByTester = new Map<string, unknown>();
    if (ids.length > 0) {
      const { data: fbs } = await sb
        .schema("cosme_check")
        .from("beta_feedback")
        .select("beta_tester_id, answers")
        .in("beta_tester_id", ids);
      for (const f of (fbs as { beta_tester_id: string; answers: unknown }[] | null) ?? []) {
        feedbackByTester.set(f.beta_tester_id, f.answers);
      }
    }

    return rows.map((r) => ({
      email: r.email,
      name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
      status: r.status,
      invited: Boolean(r.invited_at),
      source: r.source,
      createdAt: r.created_at,
      intake: toAnswerList(r.intake),
      feedback: toAnswerList(feedbackByTester.get(r.id)),
    }));
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
        info="La page publique /beta collecte les inscriptions (questionnaire persona + consentement). Ici tu déclenches l'envoi des invitations et tu consultes, par personne, les réponses au questionnaire et au retour."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Inscrits" value={stats.total} />
        <Stat label="En attente" value={stats.pending} accent={stats.pending > 0} />
        <Stat label="Invités" value={stats.invited} />
        <Stat label="Retours reçus" value={stats.feedback} />
      </div>

      <BetaLaunchPanel pending={stats.pending} />

      <SectionHeader title="Derniers inscrits" subtitle="25 plus récents — clique « Voir les réponses »." />
      <div className="neo-card overflow-x-auto">
        <BetaTestersTable rows={recent} />
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
