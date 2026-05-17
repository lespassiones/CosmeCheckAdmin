import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  Sparkles,
  Coins,
  MessageSquare,
  Scan,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import {
  Shimmer,
  StatCardsRow,
  CardSkeleton,
  TableSkeleton,
} from "@/components/Skeletons";
import { getUserDetail } from "@/lib/queries/users";
import { formatRelative, formatDateTime, formatInt, cn } from "@/lib/utils";
import { CreditsAdjuster } from "./CreditsAdjuster";
import { DangerActions } from "./DangerActions";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return { title: `User ${id.slice(0, 8)}…` };
}

export default async function UserDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return (
    <>
      <Link
        href="/users"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux utilisateurs
      </Link>

      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailBody userId={id} />
      </Suspense>
    </>
  );
}

function UserDetailSkeleton() {
  return (
    <>
      <header className="mb-6">
        <Shimmer className="h-8 w-56" />
        <Shimmer className="mt-2 h-3.5 w-72" />
      </header>
      <CardSkeleton height="h-32" />
      <Shimmer className="mb-3 mt-6 h-4 w-40" />
      <StatCardsRow count={4} />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton height="h-52" />
        <CardSkeleton height="h-52" />
      </div>
      <Shimmer className="mb-3 h-4 w-48" />
      <CardSkeleton height="h-24" />
      <Shimmer className="mb-3 mt-6 h-4 w-40" />
      <TableSkeleton rows={4} cols={3} />
    </>
  );
}

async function UserDetailBody({ userId }: { userId: string }) {
  const user = await getUserDetail(userId);
  if (!user) notFound();

  const ratio = user.credits_limit_today > 0
    ? user.credits_used_today / user.credits_limit_today
    : 0;

  return (
    <>
      <PageHeader
        title={user.first_name || user.email.split("@")[0]!}
        subtitle={user.email}
      />

      {/* Identity strip */}
      <article className="glass-card mb-6 p-5">
        <div className="grid grid-cols-2 gap-4 text-[13px] md:grid-cols-4">
          <Field icon={Mail} label="Email" value={user.email} />
          <Field
            icon={Calendar}
            label="Inscrit le"
            value={formatDateTime(user.created_at)}
          />
          <Field
            icon={Clock}
            label="Dernière connexion"
            value={
              user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : "Jamais"
            }
          />
          <Field
            icon={ShieldCheck}
            label="Provider auth"
            value={user.provider ?? "email"}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.04] pt-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              user.tier === "premium"
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                : "bg-slate-100 text-slate-600",
            )}
          >
            Tier · {user.tier}
          </span>
          {user.suspended_at ? (
            <span className="pill-rose-tag">
              Suspendu · {formatRelative(user.suspended_at)}
            </span>
          ) : (
            <span className="pill-emerald">Actif</span>
          )}
          {user.email_confirmed_at && (
            <span className="pill-emerald">Email confirmé</span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {user.id}
          </span>
        </div>
      </article>

      {/* Stats grid */}
      <SectionHeader title="Activité totale" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Analyses INCI"
          value={user.total_analyses}
          icon={Sparkles}
          tone="rose"
        />
        <StatCard
          label="Cohérence"
          value={user.total_coherence}
          icon={Sparkles}
          tone="violet"
        />
        <StatCard label="Scans OCR" value={user.total_ocr_calls} icon={Scan} />
        <StatCard
          label="Messages advisor"
          value={user.total_advisor_msgs}
          icon={MessageSquare}
        />
      </div>

      {/* Two-column: credits + AI tokens */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Credits card */}
        <article className="neo-card p-5">
          <SectionHeader title="Crédits du jour" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[36px] font-bold tabular-nums leading-none">
                {user.credits_used_today}
                <span className="ml-1 text-[18px] font-normal text-muted-foreground">
                  / {user.credits_limit_today}
                </span>
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Reste {user.credits_limit_today - user.credits_used_today} crédits
              </p>
            </div>
            <span
              aria-hidden
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 ring-1 ring-amber-200/60"
            >
              <Coins className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.04]">
            <div
              className={cn(
                "h-full transition-all",
                ratio >= 1
                  ? "bg-rose-500"
                  : ratio >= 0.7
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>

          <CreditsAdjuster
            userId={user.id}
            currentLimit={user.credits_limit_today}
          />
        </article>

        {/* AI usage card */}
        <article className="neo-card p-5">
          <SectionHeader title="Consommation IA cumulée" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Tokens in
              </p>
              <p className="mt-1 text-[24px] font-semibold tabular-nums leading-none">
                {formatInt(user.total_ai_tokens_in)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Tokens out
              </p>
              <p className="mt-1 text-[24px] font-semibold tabular-nums leading-none">
                {formatInt(user.total_ai_tokens_out)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            Total cumulé sur toute la vie du compte.
          </p>
        </article>
      </div>

      {/* Credit history sparkline as table */}
      <SectionHeader
        title="Crédits — 30 derniers jours"
        subtitle="Consommation quotidienne"
      />
      <article className="glass-card mb-8 p-5">
        {user.credit_history.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Aucune consommation enregistrée.
          </p>
        ) : (
          <div className="flex items-end gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {user.credit_history.map((d) => {
              const r = d.daily_limit > 0 ? d.used / d.daily_limit : 0;
              const h = Math.max(4, Math.round(r * 60));
              return (
                <div
                  key={d.day}
                  title={`${d.day} · ${d.used} / ${d.daily_limit}`}
                  className="flex w-6 shrink-0 flex-col items-center gap-1"
                >
                  <span
                    className={cn(
                      "w-3 rounded-t-md",
                      r >= 1
                        ? "bg-rose-500"
                        : r >= 0.7
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {d.day.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>

      {/* Recent analyses */}
      <SectionHeader title="Analyses récentes" />
      <article className="neo-card mb-8 overflow-hidden">
        {user.recent_analyses.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            Aucune analyse enregistrée.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Produit</th>
                <th className="px-5 py-3 text-right font-medium">Score</th>
                <th className="px-5 py-3 text-left font-medium">Quand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {user.recent_analyses.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5 font-medium">
                    {a.product_label ?? a.name ?? <span className="text-muted-foreground/60">Sans titre</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {a.score !== null ? a.score.toFixed(1) : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {formatRelative(a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {/* Routine */}
      <SectionHeader title="Routine actuelle" />
      {user.routine_items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Routine vide"
          description="L'utilisateur n'a encore ajouté aucun produit à sa routine."
          className="mb-8"
        />
      ) : (
        <article className="neo-card mb-8 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Produit</th>
                <th className="px-5 py-3 text-right font-medium">Score</th>
                <th className="px-5 py-3 text-left font-medium">Fréquence</th>
                <th className="px-5 py-3 text-left font-medium">Ajouté</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {user.routine_items.map((r) => (
                <tr key={r.analysis_id}>
                  <td className="px-5 py-2.5 font-medium">
                    {r.product_label ?? <span className="text-muted-foreground/60">Sans titre</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {r.score !== null ? r.score.toFixed(1) : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {r.frequency ?? "—"}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {formatRelative(r.added_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      {/* Danger zone */}
      <SectionHeader title="Actions admin" subtitle="Utiliser avec précaution." />
      <DangerActions user={user} />
    </>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}
