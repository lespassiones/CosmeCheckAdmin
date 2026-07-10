import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, ExternalLink, FileText, CheckCircle2 } from "lucide-react";
import { fetchCatalogProduct } from "@/lib/queries/catalogDb";
import { cn } from "@/lib/utils";
import { ProductPhotoEditor } from "./ProductPhotoEditor";

export const metadata = { title: "Produit — base" };
export const dynamic = "force-dynamic";

type AnalysisItem = {
  name?: string | null;
  colorRating?: string | null;
  slug?: string | null;
};

const COLOR: Record<string, string> = {
  Vert: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  Jaune: "bg-amber-50 text-amber-700 ring-amber-200/60",
  Orange: "bg-orange-50 text-orange-700 ring-orange-200/60",
  Rouge: "bg-rose-50 text-rose-700 ring-rose-200/60",
};

export default async function CatalogProductDetail({
  params,
}: {
  params: Promise<{ ean: string }>;
}) {
  const { ean } = await params;
  const detail = await fetchCatalogProduct(decodeURIComponent(ean));
  if (!detail) notFound();

  const { product: p, analysis, hasPromise } = detail;
  const items = (analysis?.items as AnalysisItem[] | undefined) ?? [];
  const counts = (analysis?.counts as Record<string, number> | undefined) ?? {};
  const analysisScore = analysis?.score as number | undefined;

  return (
    <div className="max-w-4xl">
      <Link href="/catalog/database" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Base produits
      </Link>

      {/* En-tête produit */}
      <div className="flex items-start gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
        {p.image_url ? (
          <Image src={p.image_url} alt="" width={96} height={96} className="h-24 w-24 rounded-xl object-cover ring-1 ring-black/[0.05]" unoptimized />
        ) : (
          <span className="grid h-24 w-24 place-items-center rounded-xl bg-slate-100 text-slate-400"><ImageOff className="h-7 w-7" /></span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold leading-tight">{p.name ?? "Produit sans nom"}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{p.brand ?? "Marque inconnue"} · EAN {p.ean}</p>
          {p.category && <p className="mt-1 text-[12px] text-muted-foreground/80">{p.category}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
              Score catalogue : <b>{p.score === null ? "—" : p.score.toFixed(1)}</b>{p.score_label ? ` · ${p.score_label}` : ""}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", p.source_url ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600")}>
              {p.source_url ? "Web / notre analyse" : "Sourcé catalogue"}
            </span>
            {p.has_penalizing && <span className="rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-700">Ingrédients pénalisants</span>}
            {!p.is_active && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">Inactif</span>}
            {hasPromise && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Promesse analysée</span>}
            {p.source_url && (
              <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-600 hover:underline"><ExternalLink className="h-3 w-3" /> source</a>
            )}
          </div>
        </div>
      </div>

      {/* Photo (voir / modifier) */}
      <section className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
        <h2 className="mb-3 text-[13px] font-semibold">Photo</h2>
        <ProductPhotoEditor ean={p.ean} imageUrl={p.image_url} />
      </section>

      {/* INCI */}
      <section className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
        <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><FileText className="h-4 w-4" /> Liste INCI</h2>
        <p className="text-[12px] leading-relaxed text-slate-600">{p.ingredients_text ?? "Indisponible."}</p>
      </section>

      {/* Analyse (sans synthèse) */}
      <section className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
        <h2 className="mb-2 text-[13px] font-semibold">Analyse (sans synthèse)</h2>
        {analysis ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {typeof analysisScore === "number" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">Score calculé : <b>{analysisScore.toFixed(1)}</b></span>
              )}
              {(["vert", "jaune", "orange", "rouge"] as const).map((c) =>
                counts[c] ? (
                  <span key={c} className={cn("rounded-full px-2 py-0.5 font-medium capitalize ring-1", COLOR[c.charAt(0).toUpperCase() + c.slice(1)] ?? "bg-slate-100")}>
                    {counts[c]} {c}
                  </span>
                ) : null,
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{items.length} ingrédients</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((it, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] ring-1",
                    COLOR[it.colorRating ?? ""] ?? "bg-slate-50 text-slate-600 ring-slate-200/60",
                  )}
                >
                  {it.name ?? "?"}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Pas encore d'analyse en cache pour ce produit (fréquent pour les produits issus du web).
            Le détail coloré des ingrédients apparaîtra dès qu'un utilisateur l'analyse dans l'app
            (scan / recherche), ce qui remplit le cache `product_analyses`.
          </p>
        )}
      </section>
    </div>
  );
}
