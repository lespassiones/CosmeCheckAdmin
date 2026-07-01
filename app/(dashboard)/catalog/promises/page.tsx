import Link from "next/link";
import { ScrollText, Boxes } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";
import { fetchPromiseStats, listPromiseAnalyses } from "@/lib/queries/promiseAnalyses";
import { formatInt, formatRelative, cn } from "@/lib/utils";

export const metadata = { title: "Analyses de promesse" };
export const dynamic = "force-dynamic";

export default async function PromisesPage() {
  const [stats, rows] = await Promise.all([fetchPromiseStats(), listPromiseAnalyses(100)]);

  return (
    <div>
      <PageHeader
        title="Analyses de promesse"
        subtitle="Produits dont la promesse marketing a été analysée (cohérence). Le résultat non-personnalisé est mis en cache cross-user."
        info="Produits dont la promesse marketing a été analysée (cohérence formule vs promesse). Le résultat non-personnalisé est caché et réutilisé entre utilisateurs."
      />
      <CatalogTabs />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={ScrollText} label="Analyses de promesse" value={formatInt(stats.total)} />
        <StatCard icon={Boxes} label="Résultats en cache (cross-user)" value={formatInt(stats.products)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Aucune analyse de promesse" description="Elles apparaîtront ici dès qu'un utilisateur analyse la promesse d'un produit." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/[0.05]">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-black/[0.06] text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Produit</th>
                <th className="px-3 py-2.5">Verdict</th>
                <th className="px-3 py-2.5 text-right">Quand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-black/[0.04] last:border-0 hover:bg-white">
                  <td className="px-3 py-2.5 align-top">
                    {r.ean ? (
                      <Link href={`/catalog/database/${encodeURIComponent(r.ean)}`} className="font-medium text-foreground hover:text-rose-600">
                        {r.product_name ?? "—"}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.product_name ?? "—"}</span>
                    )}
                    <span className="block text-[11px] text-muted-foreground">{r.brand ?? "—"}{r.ean ? ` · ${r.ean}` : ""}</span>
                    {(r.description || r.conclusion) && (
                      <details className="mt-1.5 max-w-2xl">
                        <summary className="cursor-pointer text-[11px] font-medium text-rose-600">Voir la description + verdict</summary>
                        {r.conclusion && (
                          <p className="mt-1 rounded-lg bg-emerald-50/60 p-2 text-[11px] leading-relaxed text-emerald-900 ring-1 ring-emerald-200/50">
                            <span className="font-semibold">Verdict : </span>{r.conclusion}
                          </p>
                        )}
                        {r.description && (
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-black/[0.04]">
                            <span className="font-semibold">Promesse analysée : </span>{r.description}
                          </p>
                        )}
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {r.tenuePct !== null ? (
                      <span className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
                        r.tenuePct >= 75 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                          : r.tenuePct >= 50 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
                      )}>
                        {r.tenuePct}% tenues
                        {r.totalPromises ? ` · ${r.tenueCount ?? 0}/${r.totalPromises}` : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">{formatRelative(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
