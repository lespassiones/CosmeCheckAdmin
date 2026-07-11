"use client";

import { useState, useTransition } from "react";
import { PlayCircle, Power } from "lucide-react";
import { toast } from "sonner";
import type { ScenariosState } from "@/lib/queries/notifications";
import { InfoHint } from "@/components/InfoHint";
import { PhoneNotificationPreview } from "./PhoneNotificationPreview";
import { setPlannerEnabled, setScenarioEnabled, runPlannerDryRun } from "./actions";

/**
 * Explications ultra simples par scénario (affichées via le petit « i »).
 * Un scénario = une règle : « SI un utilisateur est dans telle situation,
 * ALORS on lui envoie tel message ». Le planner les applique chaque jour.
 */
const SCENARIO_EXPLAIN: Record<string, string> = {
  reactivation_30d:
    "Pour qui : a déjà scanné au moins une fois, mais plus RIEN depuis 30 jours. Exemple : Marie scanne un shampoing le 1er juin puis n'ouvre plus l'app ; le 1er juillet elle reçoit « Ton décrypteur cosmétique t'attend ». But : récupérer ceux qu'on est en train de perdre pour de bon.",
  winback_14d:
    "Pour qui : plus rien scanné depuis 14 jours. C'est la relance intermédiaire, entre la douce (7 j) et la dernière chance (30 j). Exemple : « Ça fait deux semaines... reviens vérifier la compo de tes produits ».",
  winback_7d:
    "Pour qui : plus rien scanné depuis 7 jours. La relance la plus douce et la plus fréquente. Exemple : Paul scannait souvent puis s'arrête une semaine ; il reçoit « Un nouveau produit chez toi ? Vérifie sa composition en 10 secondes ».",
  onboarding_no_scan:
    "Pour qui : a créé un compte mais n'a JAMAIS scanné. Exemple : quelqu'un s'inscrit, ferme l'app sans rien essayer ; le lendemain il reçoit « Ton premier scan t'attend ». But : déclencher le tout premier scan, le moment le plus important.",
  routine_empty:
    "Pour qui : a déjà scanné des produits mais n'en a ajouté AUCUN à sa routine. Exemple : Léa a analysé 3 produits sans les enregistrer ; elle reçoit « Construis ta routine idéale ». But : l'amener vers la fonctionnalité qui fidélise (et qui détecte les conflits).",
  weekly_digest_premium:
    "Pour qui : les abonnés premium uniquement. Un petit rendez-vous chaque semaine pour entretenir l'habitude. Exemple : « Ton point beauté de la semaine ». But : que l'abonné voie de la valeur chaque semaine et reste abonné.",
};

const PLANNER_EXPLAIN =
  "Le chef d'orchestre. Une fois par jour (9h du matin, heure de Londres), il regarde chaque scénario ACTIVÉ ci-dessous, trouve les utilisateurs concernés et envoie la notification. Interrupteur OFF = rien ne part jamais, même si des scénarios sont activés. Garde-fous intégrés : une même personne reçoit au maximum UNE notification par jour (le scénario le plus haut dans la liste gagne), et jamais deux fois le même scénario dans la même semaine. « Simuler » compte qui serait touché, sans rien envoyer.";

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-rose-600" : "bg-black/15"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function ScenariosPanel({ initial }: { initial: ScenariosState }) {
  const [pending, start] = useTransition();
  const [plannerOn, setPlannerOn] = useState(initial.plannerEnabled);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.scenarios.map((s) => [s.key, s.enabled])),
  );
  const [sel, setSel] = useState<{ key: string; variant: number }>(
    initial.scenarios[0] ? { key: initial.scenarios[0].key, variant: 0 } : { key: "", variant: 0 },
  );

  const scenarios = initial.scenarios;
  const current = scenarios.find((s) => s.key === sel.key) ?? scenarios[0];
  const variant = current?.variants[sel.variant] ?? current?.variants[0];

  function togglePlanner() {
    const next = !plannerOn;
    setPlannerOn(next);
    start(async () => {
      const r = await setPlannerEnabled(next);
      if (r.ok) toast.success(next ? "Planner active." : "Planner desactive.");
      else {
        setPlannerOn(!next);
        toast.error(r.error);
      }
    });
  }

  function toggleScenario(key: string) {
    const next = !enabledMap[key];
    setEnabledMap((m) => ({ ...m, [key]: next }));
    start(async () => {
      const r = await setScenarioEnabled(key, next);
      if (r.ok) toast.success(next ? "Scenario active." : "Scenario desactive.");
      else {
        setEnabledMap((m) => ({ ...m, [key]: !next }));
        toast.error(r.error);
      }
    });
  }

  function dryRun() {
    start(async () => {
      const r = await runPlannerDryRun();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const total = r.scenarios.reduce((n, s) => n + s.audience, 0);
      if (r.scenarios.length === 0) {
        toast.info("Aucun scenario actif. Active un scenario pour voir son audience.");
      } else {
        toast.success(`Simulation : ${total} envoi(s) sur ${r.scenarios.length} scenario(s) actif(s).`);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Liste des scenarios */}
      <div className="lg:col-span-2">
        {/* Bandeau flag maitre */}
        <article className={`neo-card mb-4 p-4 ${plannerOn ? "ring-1 ring-emerald-300" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${plannerOn ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-muted-foreground"}`}>
                <Power className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-[14px] font-semibold">
                  Planner automatique
                  <InfoHint text={PLANNER_EXPLAIN} />
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {plannerOn ? "Actif : le cron enfile les scenarios chaque jour." : "Inactif : rien n'est envoye automatiquement."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={dryRun}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium transition hover:bg-black/5 disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                Simuler
              </button>
              <Toggle on={plannerOn} disabled={pending} onClick={togglePlanner} />
            </div>
          </div>
          {!plannerOn && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              Astuce : garde-le OFF tant que l&apos;app n&apos;a pas ete rebuild (aucun appareil n&apos;a encore de token). Les envois ne partiront pas avant.
            </p>
          )}
        </article>

        <div className="flex flex-col gap-2">
          {scenarios.map((s) => {
            const on = enabledMap[s.key];
            const active = sel.key === s.key;
            return (
              <article
                key={s.key}
                className={`neo-card cursor-pointer p-4 transition ${active ? "ring-1 ring-rose-300" : ""}`}
                onClick={() => setSel({ key: s.key, variant: 0 })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold">
                        {s.label}
                        <InfoHint
                          text={
                            SCENARIO_EXPLAIN[s.key] ??
                            "Règle automatique : si un utilisateur est dans cette situation, le planner lui envoie ce message."
                          }
                        />
                      </p>
                      <span className="pill text-[10px] uppercase tracking-wide">{s.segment}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{s.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {s.variants.length} variante(s) · {s.audience} destinataire(s) joignable(s)
                      <InfoHint text="Variantes = plusieurs formulations du même message ; chaque personne en reçoit une (choisie automatiquement), pour ne pas répéter toujours la même phrase. Joignables = utilisateurs qui ont l'app installée ET les notifications activées ; ce chiffre restera à 0 tant que la nouvelle version de l'app (avec les notifications) n'est pas distribuée." />
                    </p>
                  </div>
                  <Toggle on={on} disabled={pending} onClick={() => toggleScenario(s.key)} />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Apercu du scenario selectionne */}
      <div>
        <article className="neo-card p-5">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Apercu : {current?.label ?? "—"}
          </p>
          {current && current.variants.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {current.variants.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel({ key: current.key, variant: i })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    sel.variant === i ? "bg-rose-600 text-white" : "border border-black/10 bg-white hover:bg-black/5"
                  }`}
                >
                  Variante {i + 1}
                </button>
              ))}
            </div>
          )}
          <PhoneNotificationPreview title={variant?.title ?? ""} body={variant?.body ?? ""} />
        </article>
      </div>
    </div>
  );
}
