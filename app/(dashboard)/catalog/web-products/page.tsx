import { Suspense } from "react";
import { Globe, PackageCheck, FolderTree, Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsRow } from "@/components/Skeletons";
import {
  fetchWebProductsKpis,
  listPendingWebProducts,
  groupByFamily,
} from "@/lib/queries/webProducts";
import { formatInt } from "@/lib/utils";
import { WebProductCard } from "./WebProductCard";

export const metadata = { title: "Produits web" };
export const dynamic = "force-dynamic";

export default function WebProductsPage() {
  return (
    <div>
      <PageHeader
        title="Produits web"
        subtitle="Produits trouvés sur internet sans code-barres — donc absents du catalogue. Retrouve leur EAN (GPT) pour les ajouter aux 400k autres."
      />
      <Suspense fallback={<StatCardsRow count={3} />}>
        <WebProductsBody />
      </Suspense>
    </div>
  );
}

async function WebProductsBody() {
  const [kpis, rows] = await Promise.all([
    fetchWebProductsKpis(),
    listPendingWebProducts(),
  ]);
  const groups = groupByFamily(rows);

  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Inbox} label="En attente" value={formatInt(kpis.pending)} />
        <StatCard icon={PackageCheck} label="Résolus (ajoutés)" value={formatInt(kpis.resolved)} />
        <StatCard icon={FolderTree} label="Catégories" value={formatInt(kpis.categories)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Aucun produit web en attente"
          description="Les produits trouvés sur internet sans EAN apparaissent ici dès qu'OBF et la recherche GPT automatique échouent à les identifier."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.family}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[15px] font-bold tracking-tight">{group.family}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {group.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((p) => (
                  <WebProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
