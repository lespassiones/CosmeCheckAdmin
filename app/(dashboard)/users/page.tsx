import { Suspense } from "react";
import Link from "next/link";
import { Users, Search, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { listUsers } from "@/lib/queries/users";
import { formatRelative, cn } from "@/lib/utils";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

const RENEWAL_LABELS: Record<string, string> = {
  one_time: "✨ Une seule fois",
  daily: "📅 Par jour",
  weekly: "📆 Par semaine",
  monthly: "📊 Par mois",
  yearly: "📈 Par an",
};

type SearchParams = { q?: string };

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const search = (params.q ?? "").trim();

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Liste de tous les comptes — clique sur un utilisateur pour gérer ses crédits."
        info="Tous les comptes (mobile + web) avec leur tier et leur activité. Clique un utilisateur pour ajuster ses crédits (bonus ponctuel ou override de limite)."
        actions={
          <form method="GET" className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Email ou prénom…"
              className="w-72 rounded-full border-0 bg-white py-2 pl-9 pr-4 text-sm shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-rose-400/40"
            />
          </form>
        }
      />

      <Suspense key={search} fallback={<TableSkeleton rows={10} cols={6} />}>
        <UsersTable search={search} />
      </Suspense>
    </>
  );
}

async function UsersTable({ search }: { search: string }) {
  const rows = await listUsers({ search, limit: 200 });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={search ? "Aucun résultat" : "Aucun utilisateur"}
        description={
          search
            ? `Aucun compte ne correspond à "${search}".`
            : "Les inscrits apparaîtront ici dès leur premier signup."
        }
      />
    );
  }

  return (
    <article className="neo-card overflow-hidden">
      <div className="mb-0 px-5 py-3 text-[12px] text-muted-foreground">
        {rows.length} compte{rows.length > 1 ? "s" : ""}{" "}
        {search ? `trouvé${rows.length > 1 ? "s" : ""}` : "au total"}.
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Email</th>
              <th className="px-5 py-3 text-left font-medium">Prénom</th>
              <th className="px-5 py-3 text-left font-medium">Tier</th>
              <th className="px-5 py-3 text-right font-medium">Crédits</th>
              <th className="px-5 py-3 text-left font-medium">Renouvellement</th>
              <th className="px-5 py-3 text-left font-medium">Dernière connexion</th>
              <th className="px-5 py-3 text-left font-medium">Inscrit</th>
              <th className="px-5 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {rows.map((u) => {
              const ratio = u.credits_limit_today > 0
                ? u.credits_used_today / u.credits_limit_today
                : 0;
              const creditTone
                = ratio >= 1
                  ? "text-rose-700 bg-rose-50"
                  : ratio >= 0.7
                    ? "text-amber-700 bg-amber-50"
                    : "text-emerald-700 bg-emerald-50";
              return (
                <tr key={u.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <Link href={`/users/${u.id}`} className="flex items-center gap-2 font-medium hover:text-rose-600">
                      <span className="truncate max-w-[220px]">{u.email}</span>
                      {u.suspended_at && (
                        <ShieldOff aria-label="Suspendu" className="h-3.5 w-3.5 text-rose-500" />
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {u.first_name ?? <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        u.tier === "premium"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {u.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums",
                        creditTone,
                      )}
                    >
                      {u.credits_used_today} / {u.credits_limit_today}
                    </span>
                    {u.credits_bonus > 0 && (
                      <span className="ml-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-emerald-700">
                        +{u.credits_bonus}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {RENEWAL_LABELS[u.renewal_period] ?? u.renewal_period}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {u.last_sign_in_at
                      ? formatRelative(u.last_sign_in_at)
                      : <span className="text-muted-foreground/60">jamais</span>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatRelative(u.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/users/${u.id}`}
                      className="pill text-[12px]"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
