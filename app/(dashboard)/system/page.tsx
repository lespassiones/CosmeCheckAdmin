import { Suspense } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlertTriangle,
  Clock,
  Database,
  GitCommitVertical,
  Server,
  Timer,
} from "lucide-react";
import { SectionHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton, TableSkeleton } from "@/components/Skeletons";
import {
  fetchCronJobs,
  fetchTableStats,
  fetchAppliedMigrations,
  fetchPlatformHealth,
} from "@/lib/queries/system";
import { cn, formatInt, formatRelative, formatDateTime } from "@/lib/utils";
import { HealthPing } from "./HealthPing";

export const metadata = { title: "Système" };
export const dynamic = "force-dynamic";

function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Cron personnalisé";
  const [min, hour, dom, month, dow] = parts;

  if (min === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "Chaque minute";
  }
  if (min.startsWith("*/") && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return `Toutes les ${min.slice(2)} min`;
  }
  if (hour.startsWith("*/") && min === "0" && dom === "*" && month === "*" && dow === "*") {
    return `Toutes les ${hour.slice(2)} h`;
  }
  if (min === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "Toutes les heures (à :00)";
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && month === "*" && dow === "*") {
    return `Chaque jour à ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && month === "*" && /^\d+$/.test(dow)) {
    const days = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
    const d = parseInt(dow, 10);
    if (d >= 0 && d <= 6) {
      return `${days[d]} à ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
    }
  }
  return "Cron personnalisé";
}

async function readNextVersion(): Promise<string> {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const v = pkg.dependencies?.next?.replace(/^[\^~]/, "");
    return v ? `Next.js ${v}` : "Next.js 15";
  } catch {
    return "Next.js 15";
  }
}

const LARGE_TABLE_THRESHOLD_BYTES = 100 * 1024 * 1024;

export default function SystemPage() {
  return (
    <>
      <SectionHeader
        title="Santé de la plateforme"
        subtitle="Le même bilan que la surveillance automatique (alertes email chaque heure si vrai problème)."
        info="Vérifié automatiquement toutes les heures : erreurs applicatives en série, appels IA en échec, coût IA du jour au-dessus de ton seuil, tâches automatiques (crons) en panne. Si un vrai problème est détecté, tu reçois un email (max 1 par jour par type de problème). Ici tu vois l'état en direct."
      />
      <Suspense fallback={<CardSkeleton height="h-24" />}>
        <PlatformHealth />
      </Suspense>

      <SectionHeader
        title="Health check — CosmetWiki main app"
        subtitle="Ping client toutes les 10 s, mesure la latence depuis votre navigateur."
      />
      <div className="mb-8">
        <HealthPing />
      </div>

      <SectionHeader
        title="pg_cron jobs"
        subtitle="Jobs préfixés `cosme_check_*` et leur dernière exécution."
      />
      <Suspense fallback={<TableSkeleton rows={5} cols={5} />}>
        <CronJobsTable />
      </Suspense>

      <SectionHeader title="Migrations appliquées" />
      <Suspense fallback={<CardSkeleton height="h-48" />}>
        <MigrationsList />
      </Suspense>

      <SectionHeader
        title="Tailles des tables"
        subtitle="Schemas `cosme_check` et `public`, triés par taille décroissante."
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={4} />}>
        <TableStatsTable />
      </Suspense>

      <SectionHeader
        title="Environnement"
        subtitle="Pile applicative du dashboard admin."
      />
      <Suspense
        fallback={
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CardSkeleton height="h-16" />
            <CardSkeleton height="h-16" />
            <CardSkeleton height="h-16" />
            <CardSkeleton height="h-16" />
          </div>
        }
      >
        <EnvironmentGrid />
      </Suspense>
    </>
  );
}

/** Tuiles de santé : vert = OK, rouge = le seuil d'alerte email est dépassé. */
async function PlatformHealth() {
  const h = await fetchPlatformHealth();
  if (!h) return <EmptyState title="Bilan indisponible" description="La RPC de santé n'a pas répondu." />;

  const criticalCrons = [
    "cosme_check_dispatch_notifications",
    "cosme_check_nightly_score_maintenance",
    "cosme_check_run_notif_planner",
    "cosme_check_brevo_sync",
  ];
  const badCrons = (h.crons ?? []).filter(
    (c) => criticalCrons.includes(c.jobname) && c.active && c.last_status === "failed",
  );
  const costOver =
    h.ai_cost_daily_threshold_usd != null &&
    h.ai_cost_today_estimated_usd > Number(h.ai_cost_daily_threshold_usd);

  const tiles = [
    {
      label: "Erreurs (1 h)",
      value: String(h.errors_last_hour),
      bad: h.errors_last_hour >= 5,
      sub: "seuil d'alerte : 5",
    },
    {
      label: "IA en échec (1 h)",
      value: String(h.ai_errors_last_hour),
      bad: h.ai_errors_last_hour >= 5,
      sub: "seuil d'alerte : 5",
    },
    {
      label: "Coût IA aujourd'hui (estimé)",
      value: `$${Number(h.ai_cost_today_estimated_usd).toFixed(3)}`,
      bad: costOver,
      sub: h.ai_cost_daily_threshold_usd != null ? `seuil : $${h.ai_cost_daily_threshold_usd}` : "aucun seuil défini (Paramètres)",
    },
    {
      label: "Tâches critiques",
      value: badCrons.length === 0 ? "OK" : `${badCrons.length} en échec`,
      bad: badCrons.length > 0,
      sub: badCrons.length > 0 ? badCrons.map((c) => c.jobname).join(", ") : "notifs, maintenance, planner, brevo",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <article
          key={t.label}
          className={cn("neo-card p-4", t.bad ? "ring-1 ring-rose-400" : "ring-1 ring-emerald-200/60")}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.label}</p>
          <p className={cn("mt-1 text-[22px] font-bold tracking-tight", t.bad ? "text-rose-600" : "text-emerald-600")}>
            {t.value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{t.sub}</p>
        </article>
      ))}
    </div>
  );
}

async function CronJobsTable() {
  const cron = await fetchCronJobs();
  return (
    <div className="mb-8">
      {cron.needsMigration ? (
        <EmptyState
          icon={AlertTriangle}
          title="Migration 0009 requise"
          description="Le RPC public.cosme_check_admin_get_cron_jobs() n'existe pas encore. Appliquez `supabase/migrations/0009_admin_system_helpers.sql` via `supabase db push` ou via l'éditeur SQL Supabase, puis rechargez cette page."
        />
      ) : cron.rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucun job cosme_check_*"
          description="Aucun job pg_cron correspondant n'a été trouvé."
        />
      ) : (
        <article className="neo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Job</th>
                  <th className="px-4 py-2.5 text-left font-medium">Schedule</th>
                  <th className="px-4 py-2.5 text-left font-medium">Dernière exécution</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {cron.rows.map((j) => {
                  const ok = j.latest_status === "succeeded";
                  const failed = j.latest_status === "failed";
                  return (
                    <tr key={j.jobname} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-[12px] text-foreground/90">
                        {j.jobname}
                      </td>
                      <td className="px-4 py-3" title={describeCron(j.schedule)}>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[12px]">{j.schedule}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {describeCron(j.schedule)}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 tabular-nums text-muted-foreground"
                        title={j.latest_run ? formatDateTime(j.latest_run) : ""}
                      >
                        {j.latest_run ? formatRelative(j.latest_run) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {j.latest_status === null ? (
                          <span className="pill text-muted-foreground">jamais exécuté</span>
                        ) : ok ? (
                          <span className="pill-emerald">succeeded</span>
                        ) : failed ? (
                          <span className="pill-rose-tag">failed</span>
                        ) : (
                          <span className="pill-amber">{j.latest_status}</span>
                        )}
                      </td>
                      <td className="max-w-[24rem] px-4 py-3 text-[12px] text-muted-foreground">
                        <span className="line-clamp-1" title={j.latest_message ?? ""}>
                          {j.latest_message ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}

async function MigrationsList() {
  const migrations = await fetchAppliedMigrations();
  return (
    <div className="mb-8">
      {migrations.length === 0 ? (
        <EmptyState
          icon={GitCommitVertical}
          title="Aucune migration enregistrée"
          description="La table supabase_migrations.schema_migrations est vide ou inaccessible."
        />
      ) : (
        <article className="glass-card p-5">
          <p className="mb-3 text-[12px] text-muted-foreground">
            {formatInt(migrations.length)} migration{migrations.length > 1 ? "s" : ""}.
          </p>
          <ol className="divide-y divide-black/[0.04]">
            {migrations.map((m, i) => (
              <li
                key={m.version}
                className="grid grid-cols-[auto_auto_1fr] items-center gap-3 py-2.5 text-[13px]"
              >
                <span className="w-6 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                  {migrations.length - i}.
                </span>
                <span className="pill-rose font-mono text-[11px]">{m.version}</span>
                <span className="truncate font-mono text-[12px] text-foreground/90">
                  {m.name ?? "—"}
                </span>
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}

async function TableStatsTable() {
  const tableStats = await fetchTableStats();
  return (
    <div className="mb-8">
      {tableStats.needsMigration ? (
        <EmptyState
          icon={AlertTriangle}
          title="Migration 0009 requise"
          description="Le RPC public.cosme_check_admin_table_stats() n'existe pas encore."
        />
      ) : tableStats.rows.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Aucune table trouvée"
          description="Aucune table utilisateur dans `cosme_check` ou `public`."
        />
      ) : (
        <article className="neo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Schema</th>
                  <th className="px-4 py-2.5 text-left font-medium">Table</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lignes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Taille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {tableStats.rows.map((t) => {
                  const large = (t.size_bytes ?? 0) > LARGE_TABLE_THRESHOLD_BYTES;
                  return (
                    <tr
                      key={`${t.schema_name}.${t.table_name}`}
                      className="hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            t.schema_name === "cosme_check"
                              ? "pill-rose-tag"
                              : "pill",
                          )}
                        >
                          {t.schema_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-foreground/90">
                        {t.table_name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatInt(t.n_live_tup)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          large && "text-amber-700 font-semibold",
                        )}
                      >
                        <span className={cn(large && "pill-amber")}>
                          {formatBytes(t.size_bytes)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}

async function EnvironmentGrid() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—";
  const nodeVersion = process.version;
  const nodeEnv = process.env.NODE_ENV ?? "—";
  const nextVersion = await readNextVersion();
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <EnvCell icon={Database} label="Supabase URL" value={supabaseUrl} mono />
      <EnvCell icon={Server} label="Node.js" value={nodeVersion} mono />
      <EnvCell icon={Timer} label="Framework" value={nextVersion} />
      <EnvCell icon={GitCommitVertical} label="NODE_ENV" value={nodeEnv} mono />
    </div>
  );
}

function EnvCell({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <article className="neo-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={cn(
          "break-all text-[13px] text-foreground/90",
          mono && "font-mono text-[12px]",
        )}
      >
        {value}
      </p>
    </article>
  );
}
