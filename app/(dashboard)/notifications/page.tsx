import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { listNotifCampaigns, getNotifScenarios } from "@/lib/queries/notifications";
import { NotificationComposer } from "./NotificationComposer";
import { ScenariosPanel } from "./ScenariosPanel";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default async function NotificationsPage() {
  const [campaigns, scenarios] = await Promise.all([listNotifCampaigns(100), getNotifScenarios()]);

  return (
    <>
      <PageHeader
        title="Notifications push"
        subtitle="Compose, previsualise et envoie des notifications ciblees a tes utilisateurs."
        info="Chaque campagne cible un segment d'utilisateurs JOIGNABLES (ceux qui ont installe l'app et active les notifications). Previsualise l'audience avant d'envoyer, teste sur ton propre appareil, puis envoie immediatement ou programme. L'envoi part par un cron toutes les 15 min via l'edge push-dispatch (Expo Push)."
      />

      <SectionHeader
        title="Nouvelle campagne"
        info="Segment + titre + message + action au tap. « Test sur moi » envoie uniquement a ton compte. « Envoyer maintenant » declenche l'envoi tout de suite ; renseigne une date pour programmer."
      />
      <div className="mb-8">
        <NotificationComposer />
      </div>

      <SectionHeader
        title="Scenarios automatiques"
        info="Le planner enfile chaque jour des notifications ciblees selon le comportement des utilisateurs (inactivite, onboarding, routine vide, digest premium). Chaque scenario a plusieurs variantes de message (choisies automatiquement). Active un scenario + le planner maitre pour qu'il tourne. « Simuler » compte l'audience sans rien envoyer."
      />
      <div className="mb-8">
        <ScenariosPanel initial={scenarios} />
      </div>

      <SectionHeader
        title="Historique"
        subtitle="Campagnes recentes et leur statut d'envoi"
        info="Une ligne par campagne (regroupee par titre/message). Envoye = au moins un appareil a recu ; Ignore = destinataire sans appareil enregistre ; Echec = tous les envois ont echoue ; En attente = pas encore parti (programme ou cron pas encore passe)."
      />
      <article className="neo-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Titre</th>
                <th className="px-4 py-2.5 text-left font-medium">Scenario</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Envoye</th>
                <th className="px-4 py-2.5 text-right font-medium">Ignore</th>
                <th className="px-4 py-2.5 text-right font-medium">Echec</th>
                <th className="px-4 py-2.5 text-right font-medium">En attente</th>
                <th className="px-4 py-2.5 text-left font-medium">Cree</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune campagne pour le moment.
                  </td>
                </tr>
              ) : (
                campaigns.map((c, i) => (
                  <tr key={`${c.title}-${c.created_at}-${i}`} className="hover:bg-muted/40">
                    <td className="max-w-[280px] px-4 py-2.5">
                      <p className="truncate font-medium text-foreground">{c.title}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{c.body}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.scenario}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.total}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{c.sent}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c.skipped}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{c.failed}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{c.pending}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
