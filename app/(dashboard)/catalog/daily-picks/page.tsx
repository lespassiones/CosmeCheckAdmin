import { Suspense } from "react";
import Link from "next/link";
import { Lightbulb, BrainCircuit, CalendarCheck2, ChevronDown } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsRow, CardSkeleton } from "@/components/Skeletons";
import { fetchPicksKpis, listPicks, type PickView } from "@/lib/queries/catalog-picks";
import { formatInt, cn } from "@/lib/utils";
import { PickEditor } from "./PickEditor";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";

export const metadata = { title: "Daily Picks" };
export const dynamic = "force-dynamic";

type SearchParams = { view?: string };

const VIEWS: Array<{ key: PickView; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "quiz", label: "Quiz" },
  { key: "myth", label: "Mythes" },
];

function parseView(raw: string | undefined): PickView {
  if (raw === "quiz" || raw === "myth") return raw;
  return "all";
}

export default async function DailyPicksPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const view = parseView(params.view);

  function tabHref(v: PickView): string {
    return v === "all" ? "/catalog/daily-picks" : `/catalog/daily-picks?view=${v}`;
  }

  return (
    <>
      <CatalogTabs />
      <PageHeader
        title="Daily Picks"
        subtitle="Cartes rotatives quiz et mythes affichées en home."
      />

      <SectionHeader title="Vue d'ensemble" />
      <Suspense fallback={<StatCardsRow count={3} />}>
        <PicksKpis />
      </Suspense>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <Link
              key={v.key}
              href={tabHref(v.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-rose-500 text-white shadow-[0_4px_14px_-4px_rgba(244,63,94,0.5)]"
                  : "bg-white text-foreground ring-1 ring-black/[0.06] hover:bg-rose-50 hover:text-rose-700",
              )}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      <Suspense key={view} fallback={<CardSkeleton height="h-96" />}>
        <PicksList view={view} />
      </Suspense>
    </>
  );
}

async function PicksKpis() {
  const kpis = await fetchPicksKpis();
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Picks totaux" value={kpis.total} icon={Lightbulb} tone="neutral" />
      <StatCard
        label="Répartition"
        value={`${kpis.byKind.quiz} / ${kpis.byKind.myth}`}
        hint="quiz / mythes"
        icon={BrainCircuit}
        tone="violet"
      />
      <StatCard
        label="Slice du jour"
        value={kpis.currentSlice}
        hint="order_index 1–10 affichés en home"
        icon={CalendarCheck2}
        tone="rose"
      />
    </div>
  );
}

async function PicksList({ view }: { view: PickView }) {
  const picks = await listPicks({ view, limit: 300 });

  if (picks.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Aucun pick"
        description="Aucune carte ne correspond au filtre actif."
      />
    );
  }

  return (
    <article className="neo-card overflow-hidden">
      <ul className="divide-y divide-black/[0.04]">
        <li className="grid grid-cols-[64px_88px_1fr_88px_140px_120px] gap-3 bg-muted/60 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="text-right">#</span>
          <span>Type</span>
          <span>Question</span>
          <span className="text-right">Bonne idx</span>
          <span>Catégorie</span>
          <span className="text-right">Action</span>
        </li>
        {picks.map((p) => (
          <li key={p.id} className="transition-colors hover:bg-muted/40">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[64px_88px_1fr_88px_140px_120px] items-center gap-3 px-5 py-3 text-[13px]">
                <span className="text-right tabular-nums font-mono text-muted-foreground">
                  {p.order_index}
                </span>
                <span>
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      p.kind === "quiz"
                        ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60"
                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
                    )}
                  >
                    {p.kind}
                  </span>
                </span>
                <span className="line-clamp-1">{p.question}</span>
                <span className="text-right tabular-nums">{p.correct_index}</span>
                <span className="truncate text-muted-foreground">
                  {p.category ?? <span className="text-muted-foreground/60">—</span>}
                </span>
                <span className="flex justify-end">
                  <span className="pill text-[12px]">
                    Éditer
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </span>
                </span>
              </summary>
              <div className="px-5 pb-5">
                <PickEditor
                  id={p.id}
                  initialQuestion={p.question}
                  initialOptions={p.options}
                  initialCorrectIndex={p.correct_index}
                  initialReveal={p.reveal}
                  initialCategory={p.category}
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </article>
  );
}
