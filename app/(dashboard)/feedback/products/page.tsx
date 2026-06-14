import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, ImageOff, Package } from "lucide-react";
import { requireAdmin } from "@/lib/authGuard";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { FeedbackSectionTabs } from "@/components/FeedbackSectionTabs";
import {
  fetchProductErrorReports,
  fetchPhotoSubmissions,
  countPendingModeration,
  type PhotoSubmissionStatus,
} from "@/lib/queries/productModeration";
import { cn, formatDateTime } from "@/lib/utils";
import { PhotoModerationCard } from "./PhotoModerationCard";

export const metadata = { title: "Modération produit" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ photos?: string }>;

function normalisePhotoStatus(raw: string | undefined): PhotoSubmissionStatus | "all" {
  if (raw === "approved" || raw === "rejected" || raw === "all") return raw;
  return "pending";
}

export default async function ProductModerationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const photoStatus = normalisePhotoStatus(sp.photos);
  const pending = await countPendingModeration();

  return (
    <>
      <PageHeader
        title="Retours utilisateurs"
        subtitle="Signalements d'erreur et photos proposées sur les produits analysés."
      />
      <FeedbackSectionTabs active="products" pendingPhotos={pending.photos} />

      {/* Photos en attente / traitées */}
      <SectionHeader
        title="Photos proposées"
        subtitle="Valide une photo pour la lier au produit, ou rejette-la."
        actions={<PhotoFilterBar status={photoStatus} />}
      />
      <Suspense fallback={<TableSkeleton rows={3} cols={3} />}>
        <PhotoGrid status={photoStatus} />
      </Suspense>

      {/* Signalements d'erreur */}
      <SectionHeader
        title="Signalements d'erreur"
        subtitle="Messages envoyés depuis « Signaler une information incorrecte » — 100 derniers"
      />
      <Suspense fallback={<TableSkeleton rows={6} cols={4} />}>
        <ErrorReportsTable />
      </Suspense>
    </>
  );
}

function PhotoFilterBar({ status }: { status: PhotoSubmissionStatus | "all" }) {
  const TABS: { key: PhotoSubmissionStatus | "all"; label: string }[] = [
    { key: "pending", label: "En attente" },
    { key: "approved", label: "Validées" },
    { key: "rejected", label: "Rejetées" },
    { key: "all", label: "Toutes" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5 ring-1 ring-black/[0.04]">
      {TABS.map((t) => {
        const active = status === t.key;
        const href = t.key === "pending" ? "/feedback/products" : `/feedback/products?photos=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
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
  );
}

async function PhotoGrid({ status }: { status: PhotoSubmissionStatus | "all" }) {
  const rows = await fetchPhotoSubmissions(status, 100);
  if (rows.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState
          icon={status === "pending" ? Camera : ImageOff}
          title={status === "pending" ? "Aucune photo en attente" : "Aucune photo"}
          description={
            status === "pending"
              ? "Les nouvelles photos proposées par les utilisateurs apparaîtront ici."
              : "Aucune photo ne correspond à ce filtre."
          }
        />
      </div>
    );
  }
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <PhotoModerationCard key={row.id} row={row} />
      ))}
    </div>
  );
}

async function ErrorReportsTable() {
  const rows = await fetchProductErrorReports(100);
  if (rows.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState
          icon={AlertTriangle}
          title="Aucun signalement"
          description="Les erreurs signalées sur des produits apparaîtront ici."
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
              <th className="px-5 py-3 text-left font-medium">Utilisateur</th>
              <th className="px-5 py-3 text-left font-medium">Produit</th>
              <th className="px-5 py-3 text-left font-medium">Message</th>
              <th className="px-5 py-3 text-left font-medium">Quand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className="px-5 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{r.user_first_name ?? "—"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {r.user_email ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 align-top">
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{r.product_name ?? "—"}</span>
                      {r.product_ean && (
                        <span className="text-[11px] text-muted-foreground">
                          EAN {r.product_ean}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 align-top">
                  {r.message ? (
                    <p className="max-w-md whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/80">
                      {r.message}
                    </p>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-5 py-3 align-top text-muted-foreground">
                  <span title={r.created_at}>{formatDateTime(r.created_at)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
