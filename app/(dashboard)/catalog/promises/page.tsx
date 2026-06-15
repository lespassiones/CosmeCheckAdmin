import Link from "next/link";
import { ScrollText, Boxes } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";
import { fetchPromiseStats, listPromiseAnalyses } from "@/lib/queries/promiseAnalyses";
import { formatInt, formatRelative } from "@/lib/utils";

export const metadata = { title: "Analyses de promesse" };
export const dynamic = "force-dynamic";

export default async function PromisesPage() {
  const [stats, rows] = await Promise.all([fetchPromiseStats(), listPromiseAnalyses(100)]);

  return (
    <div>
      <PageHeader
        title="Analyses de promesse"
        subtitle="Produits dont la promesse marketing a été analysée (cohérence). Le résultat non-personnalisé est mis en cache cross-user."
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
                  <td className="px-3 py-2.5">
                    {r.ean ? (
                      <Link href={`/catalog/database/${encodeURIComponent(r.ean)}`} className="font-medium text-foreground hover:text-rose-600">
                        {r.product_name ?? "—"}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.product_name ?? "—"}</span>
                    )}
                    <span className="block text-[11px] text-muted-foreground">{r.brand ?? "—"}{r.ean ? ` · ${r.ean}` : ""}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    {r.verdict ?? (r.score !== null ? `Score ${r.score}` : "—")}
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
