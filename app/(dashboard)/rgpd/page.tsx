"use client";

/**
 * Page « RGPD » — récapitulatif de conformité (loi française + européenne).
 *
 * Deux sections : ce qui est EN PLACE (coché) et ce qui RESTE À FAIRE (papiers /
 * réglages, hors code). Chaque ligne a un « i » (InfoHint) qui explique, en
 * français simple, ce qui a été fait et comment — ou, pour le reste à faire,
 * comment s'y prendre et où aller.
 *
 * Les cases sont cochables et l'état est mémorisé dans le navigateur
 * (localStorage) : cocher une démarche « à faire » une fois réalisée la garde
 * cochée au prochain passage.
 */

import { useEffect, useState } from "react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { InfoHint } from "@/components/InfoHint";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  desc: string;
  info: string;
  badge?: string;
  badgeTone?: "amber" | "green";
};

type Group = { title: string; items: Item[] };

const DONE_GROUPS: Group[] = [
  {
    title: "Information & transparence",
    items: [
      {
        id: "privacy",
        label: "Politique de confidentialité complète",
        desc: "Explique quelles données sont collectées, pourquoi, et combien de temps elles sont gardées.",
        info: "Réécrite sur le site et dans l'application. Elle liste toutes les données collectées, leur usage, leur durée de conservation et tous les prestataires. C'est une obligation du RGPD (article 13).",
      },
      {
        id: "cgu",
        label: "Conditions d'utilisation (CGU) à jour",
        desc: "Site et application.",
        info: "Les CGU décrivent le service, le compte, l'abonnement et les responsabilités. Mises à jour des deux côtés, avec le droit de rétractation et la mention du médiateur de la consommation.",
      },
      {
        id: "mentions",
        label: "Mentions légales complètes",
        desc: "Nom de l'éditeur, statut (entrepreneur individuel), SIRET, hébergeur.",
        info: "La loi française (LCEN) oblige à afficher qui édite le service. On a complété : nom, statut d'entrepreneur individuel, SIRET, TVA, et l'hébergeur du site et de la base de données.",
      },
      {
        id: "processors",
        label: "Tous les prestataires extérieurs sont listés",
        desc: "Base de données, IA, statistiques, rapports d'erreur, paiement, emails.",
        info: "Chaque société qui traite des données pour nous est nommée : Supabase (base), OpenAI et Mistral (IA), PostHog (statistiques), Sentry (erreurs), Stripe et les stores (paiement), Brevo (emails).",
      },
      {
        id: "medical",
        label: "Avertissement médical",
        desc: "L'app indique clairement qu'elle ne remplace pas un médecin.",
        info: "Un message rappelle que les analyses sont informatives et ne constituent pas un avis médical. Cela évite que l'app soit considérée comme un outil de santé réglementé.",
      },
      {
        id: "ai-notice",
        label: "On prévient qu'on parle à une IA",
        desc: "L'assistant est présenté comme un « assistant IA ».",
        info: "Le sous-titre de l'assistant indique « assistant IA ». C'est une obligation du règlement européen sur l'IA (à partir d'août 2026) : l'utilisateur doit savoir qu'il parle à une machine.",
      },
    ],
  },
  {
    title: "Contrôle de l'utilisateur",
    items: [
      {
        id: "delete-account",
        label: "Suppression du compte par l'utilisateur lui-même",
        desc: "Disponible dans l'application et sur le site.",
        info: "Un bouton « Supprimer mon compte » efface le compte et toutes les données. Obligatoire (RGPD + Google Play). Avant, ça n'existait que dans l'app ; on l'a ajouté aussi sur le site.",
      },
      {
        id: "report",
        label: "Bouton « Signaler un problème »",
        desc: "L'utilisateur peut remonter un souci depuis son profil.",
        info: "Depuis son profil, l'utilisateur choisit un objet (assistant, promesse, autre) et écrit un message. Le signalement arrive ici, dans « Retours ». Répond aussi à la règle Google sur les contenus générés par IA.",
      },
      {
        id: "skin-consent",
        label: "Message clair avant de renseigner sa peau",
        desc: "Une phrase explique l'usage, et l'utilisateur peut « Passer ».",
        info: "Les infos de peau sont des données sensibles (santé). Une phrase à la première étape explique à quoi elles servent, et le bouton « Passer » permet de refuser. Renseigner = accepter, sans case en plus.",
      },
      {
        id: "newsletter",
        label: "Newsletter uniquement si la case est cochée",
        desc: "Aucun email marketing envoyé sans accord.",
        info: "À l'inscription, la case newsletter est décochée par défaut. Seules les personnes qui la cochent reçoivent des emails marketing. Les emails de service (sécurité, compte) restent possibles.",
      },
      {
        id: "notifications",
        label: "Notifications activées seulement à la demande",
        desc: "Rien n'est envoyé si l'utilisateur ne les active pas.",
        info: "Les notifications sont désactivées par défaut. L'utilisateur doit les activer dans son profil, puis accepter la demande du téléphone. Aucun envoi sans ce double accord.",
      },
      {
        id: "withdrawal",
        label: "Droit de rétractation expliqué",
        desc: "14 jours ; remboursement du temps d'abonnement non utilisé.",
        info: "Les CGU indiquent qu'on peut se rétracter dans les 14 jours après un abonnement pris en ligne, avec remboursement de la partie non utilisée. Formulation simple, sans piège.",
      },
    ],
  },
  {
    title: "Données & sécurité",
    items: [
      {
        id: "eu-hosting",
        label: "Données hébergées en Europe",
        desc: "Base de données, statistiques et rapports d'erreur.",
        info: "La base (Supabase), les statistiques (PostHog) et les rapports d'erreur (Sentry) sont hébergés dans l'Union européenne. Cela évite les problèmes de transfert de données hors Europe.",
      },
      {
        id: "security",
        label: "Données protégées",
        desc: "Chiffrées, et chaque personne ne voit que ses propres données.",
        info: "Les données sont chiffrées pendant le transport et au repos. Une règle de sécurité (RLS) garantit que chaque utilisateur ne voit que ses propres données, jamais celles des autres.",
      },
      {
        id: "analytics-anon",
        label: "Statistiques anonymes, sans bandeau cookies",
        desc: "Pas de suivi par personne, pas d'enregistrement d'écran.",
        info: "L'outil de statistiques (PostHog) a été réglé en mode anonyme : plus d'email envoyé, plus d'enregistrement d'écran. Dans ce mode, la CNIL n'exige pas de bandeau cookies, donc l'app reste simple.",
      },
      {
        id: "ai-transfer",
        label: "Envoi à l'IA encadré",
        desc: "Transfert hors Europe couvert par un contrat type ; pas d'entraînement.",
        info: "Quand une analyse utilise l'IA, seules les données nécessaires partent chez OpenAI/Mistral. Le transfert vers les USA (OpenAI) est couvert par un contrat type européen, et les données ne servent pas à entraîner l'IA (réglages confirmés côté comptes, voir « à faire »).",
      },
      {
        id: "minors",
        label: "Accès réservé aux 15 ans et plus",
        desc: "Indiqué dans la politique de confidentialité.",
        info: "La politique précise que le service s'adresse aux 15 ans et plus. En dessous, l'accord d'un parent est nécessaire. C'est l'âge du consentement numérique en France.",
      },
    ],
  },
];

const TODO_ITEMS: Item[] = [
  {
    id: "mediator",
    label: "Médiateur de la consommation",
    desc: "Prendre un abonnement, puis mettre son nom dans les CGU.",
    badge: "Obligatoire",
    badgeTone: "amber",
    info: "Obligatoire car il y a un abonnement payant : tout vendeur en ligne doit proposer un médiateur gratuit en cas de litige. S'abonner (env. 20–50 €/an) chez CNPM-Médiation-Consommation, Medicys ou SAS Médiation Solution, puis écrire son nom et son contact dans les CGU. Aucune informatique.",
  },
  {
    id: "registry",
    label: "Registre des données",
    desc: "Tableau qui liste les données et à quoi elles servent.",
    badge: "Obligatoire",
    badgeTone: "amber",
    info: "Document interne listant tous les traitements de données (comptes, analyses, paiements…) et leur but. À garder au cas où la CNIL le demande. Modèle gratuit à télécharger sur cnil.fr (« registre simplifié »). À remplir une fois, puis mettre à jour de temps en temps.",
  },
  {
    id: "dpia",
    label: "Analyse d'impact (AIPD)",
    desc: "Petit dossier, car on traite des informations liées à la peau.",
    badge: "Obligatoire",
    badgeTone: "amber",
    info: "Étude à faire quand on traite des données sensibles (ici, la peau) : elle décrit les risques et comment on les réduit. Se fait avec le logiciel gratuit « PIA » de la CNIL (téléchargeable sur cnil.fr). À garder en interne, rien à envoyer.",
  },
  {
    id: "google-play",
    label: "Formulaires Google Play",
    desc: "« Sécurité des données » et « Applications de santé ».",
    badge: "À la publication",
    badgeTone: "amber",
    info: "Au moment de publier l'app, la Google Play Console demande deux formulaires : « Sécurité des données » (dire quelles données sont collectées) et « Applications de santé » (répondre : aucune fonction santé, grâce à l'avertissement médical). À faire dans la console, ce sont des cases à cocher.",
  },
  {
    id: "mistral",
    label: "Réglage IA Mistral",
    desc: "Interdire l'usage des données pour entraîner l'IA.",
    badge: "Fait",
    badgeTone: "green",
    info: "Dans console.mistral.ai → Admin → API → Confidentialité, désactiver l'option « Utilisation des données pour améliorer nos services ». Les appels de l'app ne servent alors plus à entraîner Mistral. (Fait.)",
  },
  {
    id: "openai",
    label: "Réglages & contrat OpenAI",
    desc: "Couper le partage des données + signer le contrat (DPA).",
    badge: "Fait",
    badgeTone: "green",
    info: "Sur platform.openai.com → Organization settings → Data controls → onglet « Sharing » : mettre les 3 options sur « Disabled » (sinon les données servent à entraîner OpenAI). Puis signer le contrat de protection des données (DPA) sur openai.com/policies/data-processing-addendum avec le nom de l'entreprise et l'Org ID. (Fait.)",
  },
];

// État par défaut : tout ce qui est « en place » est coché ; côté « à faire »,
// seuls Mistral et OpenAI sont cochés (déjà réglés).
const DEFAULTS: Record<string, boolean> = (() => {
  const map: Record<string, boolean> = {};
  for (const g of DONE_GROUPS) for (const it of g.items) map[it.id] = true;
  for (const it of TODO_ITEMS) map[it.id] = it.id === "mistral" || it.id === "openai";
  return map;
})();

const STORAGE_KEY = "cosmecheck-admin-rgpd-checklist-v1";

const ALL_IDS = [
  ...DONE_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
  ...TODO_ITEMS.map((i) => i.id),
];

export default function RgpdPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // localStorage indisponible : on garde les valeurs par défaut.
    }
  }, []);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const doneCount = ALL_IDS.filter((id) => checked[id]).length;

  return (
    <>
      <PageHeader
        title="Conformité RGPD"
        subtitle="Site web + application mobile — loi française et européenne. Survole le « i » de chaque ligne pour le détail."
        info="Récapitulatif de tout ce qui a été mis en place pour respecter la protection des données, et des démarches (papiers, abonnements) qu'il reste à faire. Les cases cochées sont mémorisées sur cet ordinateur."
      />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
        <span className="tabular-nums">{doneCount}</span>
        <span className="font-normal text-emerald-700/80">/ {ALL_IDS.length} points validés</span>
      </div>

      <SectionHeader
        title="✅ En place"
        subtitle="Ces éléments sont actifs sur le site et dans l'application."
      />
      <div className="mb-8 flex flex-col gap-6">
        {DONE_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <article className="neo-card">
              {group.items.map((it, i) => (
                <ChecklistRow
                  key={it.id}
                  item={it}
                  checked={!!checked[it.id]}
                  onToggle={() => toggle(it.id)}
                  first={i === 0}
                />
              ))}
            </article>
          </div>
        ))}
      </div>

      <SectionHeader
        title="🗂️ À faire"
        subtitle="Papiers et abonnements, hors informatique. Coche une case une fois la démarche réalisée."
      />
      <article className="neo-card mb-10">
        {TODO_ITEMS.map((it, i) => (
          <ChecklistRow
            key={it.id}
            item={it}
            checked={!!checked[it.id]}
            onToggle={() => toggle(it.id)}
            first={i === 0}
          />
        ))}
      </article>
    </>
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
  first,
}: {
  item: Item;
  checked: boolean;
  onToggle: () => void;
  first: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40",
        !first && "border-t border-black/[0.05]",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-600"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "text-[14.5px] font-semibold",
              checked && "text-foreground",
            )}
          >
            {item.label}
          </span>
          {item.badge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                item.badgeTone === "green"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
              )}
            >
              {item.badge}
            </span>
          )}
          <InfoHint text={item.info} />
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {item.desc}
        </span>
      </span>
    </label>
  );
}
