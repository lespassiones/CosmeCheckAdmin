import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/authGuard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { FeedbackSectionTabs } from "@/components/FeedbackSectionTabs";
import { countPendingModeration } from "@/lib/queries/productModeration";
import { countBrandSubmissions, fetchBrandSubmissions, type BrandStatus } from "@/lib/queries/brandSubmissions";
import { cn } from "@/lib/utils";
import { BrandSubmissionCard } from "./BrandSubmissionCard";

export const metadata = { title: "Marques" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ s?: string }>;

function normalise(raw: string | undefined): BrandStatus | "all" {
  return raw === "approved" || raw === "rejected" || raw === "all" ? raw : "pending";
}

export default async function BrandsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const status = normalise((await searchParams).s);
  const [rows, counts, moderation] = await Promise.all([
    fetchBrandSubmissions(status),
    countBrandSubmissions(),
    countPendingModeration(),
  ]);

  const tabs: { key: BrandStatus | "all"; label: string; n?: number }[] = [
    { key: "pending", label: "À vérifier", n: counts.pending },
    { key: "approved", label: "Dans l'app", n: counts.approved },
    { key: "rejected", label: "Refusés", n: counts.rejected },
    { key: "all", label: "Tous" },
  ];

  return (
    <>
      <PageHeader
        title="Retours utilisateurs"
        subtitle="Produits proposés par les marques depuis cosme-check.com/marques."
        info="Rien n'entre dans l'app sans passer par ici. Vérifie la fiche (page produit, photos), calcule la note, puis mets le produit dans l'app : la marque reçoit alors un mail avec sa note et son badge."
      />
      <FeedbackSectionTabs active="brands" pendingPhotos={moderation.photos} pendingBrands={counts.pending} />

      <div className="mb-5 inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5 ring-1 ring-black/[0.04]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/feedback/brands" : `/feedback/brands?s=${t.key}`}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition",
              status === t.key ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.n != null ? <span className="ml-1 text-muted-foreground">{t.n}</span> : null}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={status === "pending" ? "Aucun produit à vérifier" : "Rien ici"}
          description={status === "pending" ? "Les produits envoyés par les marques apparaîtront ici." : "Aucune fiche ne correspond à ce filtre."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((r) => (
            <BrandSubmissionCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </>
  );
}
