import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Bascule entre les deux sections de « Retours » :
 *   - Avis & contact (notes + messages de la page contact) → /feedback
 *   - Modération produit (signalements d'erreur + photos)  → /feedback/products
 */
export function FeedbackSectionTabs({
  active,
  pendingPhotos,
}: {
  active: "reviews" | "products";
  pendingPhotos?: number;
}) {
  const tabs = [
    { key: "reviews" as const, label: "Avis & contact", href: "/feedback" },
    { key: "products" as const, label: "Modération produit", href: "/feedback/products" },
  ];
  return (
    <div className="mb-6 inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5 ring-1 ring-black/[0.04]">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition",
              isActive
                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.key === "products" && pendingPhotos ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {pendingPhotos}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
