import Link from "next/link";
import {
  ShieldAlert,
  Shield,
  Coins,
  ClipboardList,
  Search,
  Activity,
  Ban,
  Network,
  UserX,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import {
  fetchSecurityKpis,
  fetchErrorLog,
  fetchTopRateLimitedIps,
  fetchCreditsExhaustedToday,
  fetchAdminAuditLog,
} from "@/lib/queries/security";
import { formatRelative, formatDateTime, formatInt } from "@/lib/utils";

export const metadata = { title: "Sécurité" };
export const dynamic = "force-dynamic";

type SearchParams = { route?: string };

/** Truncate a string to `n` chars, appending an ellipsis if cut. */
function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const routeFilter = (params.route ?? "").trim();

  const [kpis, errors, rateLimited, exhausted, audit] = await Promise.all([
    fetchSecurityKpis(),
    fetchErrorLog({ routePrefix: routeFilter, limit: 50 }),
    fetchTopRateLimitedIps(20),
    fetchCreditsExhaustedToday(),
    fetchAdminAuditLog(30),
  ]);

  return (
    <>
      <PageHeader
        title="Sécurité"
        subtitle="Erreurs runtime, abus rate-limit, activité admin."
      />

      {/* ─── KPI cards ─────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Erreurs 24 h"
          value={kpis.errors24h}
          hint="dans error_log"
          icon={ShieldAlert}
          tone={kpis.errors24h > 10 ? "rose" : "neutral"}
        />
        <StatCard
          label="IPs rate-limited"
          value={kpis.rateLimitedIps}
          hint="bursts > 20 dans la fenêtre"
          icon={Network}
          tone={kpis.rateLimitedIps > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="Crédits épuisés aujourd'hui"
          value={kpis.creditsExhaustedToday}
          hint="users ayant atteint la limite"
          icon={Coins}
          tone={kpis.creditsExhaustedToday > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="Actions admin 24 h"
          value={kpis.adminActions24h}
          hint="dans admin_audit_log"
          icon={ClipboardList}
          tone="violet"
        />
      </div>

      {/* ─── Error log feed ───────────────────────────────────────────── */}
      <SectionHeader
        title="Erreurs runtime"
        subtitle="Last 50 entries from `error_log`"
        actions={
          <form method="GET" className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="route"
              defaultValue={routeFilter}
              placeholder="Filtrer par route…"
              className="w-64 rounded-full border-0 bg-white py-2 pl-9 pr-4 text-sm shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-rose-400/40"
            />
          </form>
        }
      />
      {errors.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={Shield}
            title={routeFilter ? "Aucune erreur pour ce filtre" : "Aucune erreur récente"}
            description={
              routeFilter
                ? `Aucune entrée dans error_log dont la route commence par "${routeFilter}".`
                : "Bonne nouvelle, rien ne crashe en production en ce moment."
            }
          />
        </div>
      ) : (
        <article className="neo-card mb-8 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Quand</th>
                  <th className="px-5 py-3 text-left font-medium">Route</th>
                  <th className="px-5 py-3 text-left font-medium">Erreur</th>
                  <th className="px-5 py-3 text-left font-medium">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {errors.map((e) => (
                  <tr key={e.id} className="align-top transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {formatRelative(e.created_at)}
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px]">
                      {e.route ?? <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {e.stack ? (
                        <details className="group">
                          <summary className="cursor-pointer list-none text-[13px] hover:text-rose-600">
                            <span className="inline-block max-w-[480px] truncate align-middle">
                              {truncate(e.error, 80) || "—"}
                            </span>
                            <span className="ml-2 text-[11px] text-muted-foreground group-open:hidden">
                              [stack]
                            </span>
                          </summary>
                          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-snug text-foreground/80 scrollbar-thin">
                            {e.stack}
                          </pre>
                        </details>
                      ) : (
                        <span className="inline-block max-w-[480px] truncate align-middle">
                          {truncate(e.error, 80) || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                      {e.user_id ? (
                        <Link href={`/users/${e.user_id}`} className="hover:text-rose-600">
                          {e.user_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* ─── Top rate-limited IPs ─────────────────────────────────────── */}
      <SectionHeader
        title="Top IPs avec rate-limit"
        subtitle="Clés `burst:<ip>` les plus actives dans la fenêtre courante."
      />
      {rateLimited.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={Network}
            title="Aucune IP en burst"
            description="Personne ne tape trop fort sur l'API en ce moment."
          />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rateLimited.map((r) => (
            <article
              key={r.key}
              className="neo-card flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="pill font-mono text-[12px]">{r.ip}</span>
                </div>
                <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatInt(r.count)}
                  </span>
                  <span>hits · fenêtre {formatRelative(r.window_start)}</span>
                </p>
              </div>
              <button
                type="button"
                disabled
                title="À implémenter"
                className="btn-secondary cursor-not-allowed gap-1.5 px-3 py-1.5 text-[12px] opacity-60"
              >
                <Ban className="h-3.5 w-3.5" />
                Blacklist
              </button>
            </article>
          ))}
        </div>
      )}

      {/* ─── Crédits — users à la limite ──────────────────────────────── */}
      <SectionHeader
        title="Utilisateurs ayant épuisé leurs crédits aujourd'hui"
        subtitle="Si plusieurs users hit la limite régulièrement, augmente le quota par défaut."
      />
      {exhausted.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={Coins}
            title="Aucun user à la limite"
            description="Les quotas quotidiens couvrent l'usage actuel."
          />
        </div>
      ) : (
        <article className="neo-card mb-8 overflow-hidden">
          <ul className="divide-y divide-black/[0.04]">
            {exhausted.map((u) => (
              <li
                key={u.user_id}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <Link
                  href={`/users/${u.user_id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-rose-600"
                >
                  <UserX className="h-4 w-4 shrink-0 text-rose-500" />
                  <span className="truncate text-[13px] font-medium">{u.email}</span>
                </Link>
                <span className="pill-rose-tag tabular-nums">
                  {formatInt(u.used)} / {formatInt(u.daily_limit)}
                </span>
                <Link
                  href={`/users/${u.user_id}`}
                  className="pill shrink-0 text-[12px]"
                >
                  Détail →
                </Link>
              </li>
            ))}
          </ul>
        </article>
      )}

      {/* ─── Admin audit log ──────────────────────────────────────────── */}
      <SectionHeader
        title="Activité admin récente"
        subtitle="Forensic trail de toutes les actions effectuées dans ce dashboard."
      />
      {audit.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune action admin enregistrée"
          description="Le journal admin_audit_log est vide ou n'a pas encore reçu d'écriture."
        />
      ) : (
        <article className="neo-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Quand</th>
                  <th className="px-5 py-3 text-left font-medium">Admin</th>
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                  <th className="px-5 py-3 text-left font-medium">Target user</th>
                  <th className="px-5 py-3 text-left font-medium">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {audit.map((a) => (
                  <tr key={a.id} className="align-top transition-colors hover:bg-muted/40">
                    <td
                      className="px-5 py-3 text-muted-foreground whitespace-nowrap"
                      title={formatDateTime(a.created_at)}
                    >
                      {formatRelative(a.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="truncate text-[13px]">
                        {a.admin_email ?? <span className="text-muted-foreground/60">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="pill font-mono text-[11px]">{a.action}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] whitespace-nowrap">
                      {a.target_user_id ? (
                        <Link
                          href={`/users/${a.target_user_id}`}
                          className="text-muted-foreground hover:text-rose-600"
                          title={a.target_user_email ?? a.target_user_id}
                        >
                          {a.target_user_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {a.payload && Object.keys(a.payload).length > 0 ? (
                        <details className="group">
                          <summary className="cursor-pointer list-none text-[12px] text-muted-foreground hover:text-rose-600">
                            <span className="inline-block max-w-[260px] truncate align-middle">
                              {truncate(JSON.stringify(a.payload), 60)}
                            </span>
                          </summary>
                          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-snug text-foreground/80 scrollbar-thin">
                            {JSON.stringify(a.payload, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </>
  );
}
