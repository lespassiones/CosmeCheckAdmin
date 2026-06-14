import { Suspense } from "react";
import Link from "next/link";
import { MessageSquare, Star, Mail, MessageCircle } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsRow, TableSkeleton } from "@/components/Skeletons";
import {
  fetchFeedbackKpis,
  fetchFeedbackRows,
  type FeedbackKind,
  type FeedbackRow,
} from "@/lib/queries/feedback";
import { cn, formatInt, formatDateTime } from "@/lib/utils";
import { FeedbackSectionTabs } from "@/components/FeedbackSectionTabs";
import { countPendingModeration } from "@/lib/queries/productModeration";

export const metadata = { title: "Retours" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; rating?: string }>;

const TRIGGER_LABEL: Record<string, string> = {
  first_promesse: "1ère promesse",
  fifth_promesse: "5ème promesse",
};

function normaliseKind(raw: string | undefined): FeedbackKind | "all" {
  if (raw === "feedback" || raw === "contact") return raw;
  return "all";
}

function normaliseRating(raw: string | undefined): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n as 1 | 2 | 3 | 4 | 5;
  return null;
}

export default async function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const kind = normaliseKind(sp.kind);
  const rating = normaliseRating(sp.rating);
  const pending = await countPendingModeration();

  return (
    <>
      <PageHeader
        title="Retours utilisateurs"
        subtitle="Avis (notes 1-5) et messages reçus via la page Contact."
      />
      <FeedbackSectionTabs active="reviews" pendingPhotos={pending.photos} />

      <SectionHeader title="Synthèse" subtitle="Tous les retours confondus" />
      <Suspense fallback={<StatCardsRow count={4} />}>
        <FeedbackKpisSection />
      </Suspense>

      <SectionHeader
        title="Liste des retours"
        subtitle="Tri du plus récent au plus ancien — 100 dernières entrées"
        actions={<FilterBar kind={kind} rating={rating} />}
      />
      <Suspense fallback={<TableSkeleton rows={10} cols={5} />}>
        <FeedbackTableSection kind={kind} rating={rating} />
      </Suspense>
    </>
  );
}

async function FeedbackKpisSection() {
  const k = await fetchFeedbackKpis();
  const avg = k.averageRating;
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Note moyenne"
        value={avg !== null ? avg.toFixed(1) : "—"}
        hint={`sur ${formatInt(k.totalFeedback)} avis`}
        icon={Star}
        tone="amber"
      />
      <StatCard
        label="Avis collectés"
        value={k.totalFeedback}
        hint="notes étoilées soumises"
        icon={MessageSquare}
        tone="rose"
      />
      <StatCard
        label="Messages contact"
        value={k.totalContact}
        hint="page Contact"
        icon={Mail}
        tone="violet"
      />
      <StatCard
        label="Contact (7 jours)"
        value={k.contactLast7Days}
        hint="messages reçus récemment"
        icon={MessageCircle}
        tone="emerald"
      />
    </div>
  );
}

function FilterBar({
  kind,
  rating,
}: {
  kind: FeedbackKind | "all";
  rating: 1 | 2 | 3 | 4 | 5 | null;
}) {
  // Build query strings preserving the other filter.
  function url(nextKind: FeedbackKind | "all", nextRating: 1 | 2 | 3 | 4 | 5 | null) {
    const params = new URLSearchParams();
    if (nextKind !== "all") params.set("kind", nextKind);
    if (nextRating !== null) params.set("rating", String(nextRating));
    const qs = params.toString();
    return qs ? `/feedback?${qs}` : "/feedback";
  }

  const KIND_TABS: { key: FeedbackKind | "all"; label: string }[] = [
    { key: "all", label: "Tout" },
    { key: "feedback", label: "Avis" },
    { key: "contact", label: "Contact" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5 ring-1 ring-black/[0.04]">
        {KIND_TABS.map((t) => {
          const active = kind === t.key;
          return (
            <Link
              key={t.key}
              href={url(t.key, t.key === "feedback" ? rating : null)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                active
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {/* Rating filter only relevant for feedback kind */}
      {kind !== "contact" && (
        <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5 ring-1 ring-black/[0.04]">
          <Link
            href={url(kind, null)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition",
              rating === null
                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Toutes
          </Link>
          {([1, 2, 3, 4, 5] as const).map((r) => {
            const active = rating === r;
            return (
              <Link
                key={r}
                href={url(kind, r)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-medium tabular-nums transition",
                  active
                    ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}★
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function FeedbackTableSection({
  kind,
  rating,
}: {
  kind: FeedbackKind | "all";
  rating: 1 | 2 | 3 | 4 | 5 | null;
}) {
  const rows = await fetchFeedbackRows({
    kind,
    rating: kind === "contact" ? null : rating,
    limit: 100,
  });

  if (rows.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState
          icon={MessageSquare}
          title="Aucun retour pour ces filtres"
          description="Aucune entrée ne correspond à ta sélection. Essaie de changer le type ou la note."
        />
      </div>
    );
  }

  return (
    <article className="neo-card mb-8 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Type</th>
              <th className="px-5 py-3 text-left font-medium">Utilisateur</th>
              <th className="px-5 py-3 text-left font-medium">Note / Sujet</th>
              <th className="px-5 py-3 text-left font-medium">Message</th>
              <th className="px-5 py-3 text-left font-medium">Quand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {rows.map((r) => (
              <FeedbackTableRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function FeedbackTableRow({ row }: { row: FeedbackRow }) {
  return (
    <tr className="transition-colors hover:bg-muted/40">
      <td className="px-5 py-3 align-top">
        {row.kind === "feedback" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/60">
            <Star className="h-3 w-3" />
            Avis
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200/60">
            <Mail className="h-3 w-3" />
            Contact
          </span>
        )}
      </td>
      <td className="px-5 py-3 align-top">
        {row.kind === "feedback" ? (
          <div className="flex flex-col gap-0.5">
            <span className="truncate font-medium">{row.user_email ?? "—"}</span>
            {row.trigger_source && (
              <span className="text-[11px] text-muted-foreground">
                {TRIGGER_LABEL[row.trigger_source] ?? row.trigger_source}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="truncate font-medium">{row.contact_first_name ?? "—"}</span>
            <span className="text-[11px] text-muted-foreground truncate">
              {row.contact_email ?? "—"}
            </span>
            {row.user_email && row.user_email !== row.contact_email && (
              <span className="text-[10px] text-muted-foreground/70">
                connecté : {row.user_email}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-3 align-top">
        {row.kind === "feedback" ? (
          <StarRating value={row.rating ?? 0} />
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            {row.contact_subject ?? "—"}
          </span>
        )}
      </td>
      <td className="px-5 py-3 align-top">
        {row.message ? (
          <p className="max-w-md whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/80">
            {row.message}
          </p>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="px-5 py-3 align-top text-muted-foreground">
        <span title={row.created_at}>{formatDateTime(row.created_at)}</span>
      </td>
    </tr>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Note ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= value ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200",
          )}
        />
      ))}
      <span className="ml-1.5 text-[12px] font-semibold tabular-nums">{value}</span>
    </span>
  );
}
