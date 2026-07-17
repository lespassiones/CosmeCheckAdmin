"use client";

import { useState, useTransition } from "react";
import { Check, X, ImageOff, Pencil, ScanText, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approvePhotoSubmission, rejectPhotoSubmission, ocrSubmission, publishSubmission } from "./actions";
import type { PhotoSubmissionRow } from "@/lib/queries/productModeration";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Carte de modération d'une photo proposée. L'admin choisit la photo à retenir
 * (par défaut la 1ʳᵉ), puis valide (→ devient l'image du produit) ou rejette.
 * Les soumissions déjà traitées sont affichées en lecture seule.
 */
export function PhotoModerationCard({ row }: { row: PhotoSubmissionRow }) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState(row.photo_path_1);
  // Permet de revenir sur une décision déjà prise (re-valider une autre photo,
  // ou rejeter une photo précédemment validée → l'image est retirée du produit).
  const [editing, setEditing] = useState(false);

  const photos = [
    { path: row.photo_path_1, url: row.photo_url_1 },
    ...(row.photo_path_2 && row.photo_url_2
      ? [{ path: row.photo_path_2, url: row.photo_url_2 }]
      : []),
  ];

  const isPending = row.status === "pending";
  const canEdit = isPending || editing;

  // Contribution à décrypter : produit avec EAN mais pas encore d'INCI au catalogue.
  const showPublish = isPending && !!row.ean && !row.catalog_has_inci;
  const [inci, setInci] = useState(row.extracted_inci ?? "");
  const [pName, setPName] = useState(row.extracted_name ?? row.name ?? "");
  const [pBrand, setPBrand] = useState(row.extracted_brand ?? row.brand ?? "");
  const [pCategory, setPCategory] = useState(row.category ?? "");
  const [ocrLoading, setOcrLoading] = useState(false);

  function runOcr() {
    setOcrLoading(true);
    startTransition(async () => {
      const r = await ocrSubmission(row.id);
      setOcrLoading(false);
      if (r.ok) {
        if (r.inci) setInci(r.inci);
        if (r.name) setPName(r.name);
        if (r.brand) setPBrand(r.brand);
        toast.success("Ingrédients lus. Relis / corrige puis publie.");
      } else toast.error(r.error);
    });
  }

  function publish() {
    startTransition(async () => {
      const r = await publishSubmission({
        submissionId: row.id,
        ean: row.ean ?? "",
        name: pName,
        brand: pBrand,
        inci,
        category: pCategory,
        imagePath: chosen,
      });
      if (r.ok) toast.success(`Publié au catalogue · score ${r.score}/20.`);
      else toast.error(r.error);
    });
  }

  const fieldCls =
    "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-rose-300";

  function approve() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("submission_id", row.id);
      fd.append("photo_path", chosen);
      const r = await approvePhotoSubmission(fd);
      if (r.ok) { toast.success("Photo validée et liée au produit."); setEditing(false); }
      else toast.error(r.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("submission_id", row.id);
      const r = await rejectPhotoSubmission(fd);
      if (r.ok) { toast.success("Photo rejetée, image retirée du produit."); setEditing(false); }
      else toast.error(r.error);
    });
  }

  return (
    <article className="neo-card overflow-hidden p-4">
      {/* Photos */}
      <div className="flex gap-3">
        {photos.map((p, i) => {
          const selected = canEdit && chosen === p.path;
          return (
            <button
              key={i}
              type="button"
              onClick={() => canEdit && setChosen(p.path)}
              disabled={!canEdit}
              className={cn(
                "relative aspect-square w-1/2 overflow-hidden rounded-xl ring-2 transition",
                selected ? "ring-rose-500" : "ring-black/[0.06]",
                canEdit && "cursor-pointer hover:ring-rose-300",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {selected && (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
        {photos.length === 0 && (
          <div className="flex aspect-square w-1/2 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Infos produit + utilisateur */}
      <div className="mt-3 space-y-1">
        <p className="text-[14px] font-semibold leading-tight">
          {row.name ?? "Produit sans nom"}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {row.brand ?? "Marque inconnue"}
          {row.ean ? ` · EAN ${row.ean}` : " · sans code-barres"}
        </p>
        {row.category && (
          <p className="text-[11px] text-muted-foreground/80">{row.category}</p>
        )}
        <p className="pt-1 text-[11px] text-muted-foreground">
          Par <span className="font-medium">{row.user_first_name ?? "—"}</span>
          {row.user_email ? ` · ${row.user_email}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground/70">{formatDateTime(row.created_at)}</p>
      </div>

      {/* Contribution scan : OCR → relecture → publication au catalogue */}
      {showPublish && (
        <div className="mt-3 rounded-xl bg-rose-50/60 p-3 ring-1 ring-rose-200/50">
          <p className="mb-2 text-[12px] font-semibold text-rose-700">
            Décrypter &amp; publier au catalogue
          </p>
          <button
            type="button"
            onClick={runOcr}
            disabled={pending || ocrLoading}
            className="btn-secondary mb-2 w-full justify-center text-[13px] disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
            Lire les ingrédients (OCR)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nom" className={fieldCls} />
            <input value={pBrand} onChange={(e) => setPBrand(e.target.value)} placeholder="Marque" className={fieldCls} />
          </div>
          <input
            value={pCategory}
            onChange={(e) => setPCategory(e.target.value)}
            placeholder="Catégorie (slug, optionnel)"
            className={`${fieldCls} mt-2`}
          />
          <textarea
            value={inci}
            onChange={(e) => setInci(e.target.value)}
            placeholder="Liste INCI : Aqua, Glycerin, Niacinamide, …"
            rows={4}
            className={`${fieldCls} mt-2 resize-y`}
          />
          <button
            type="button"
            onClick={publish}
            disabled={pending || inci.trim().length < 20}
            className="btn-primary mt-2 w-full justify-center text-[13px] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Calculer &amp; Publier
          </button>
        </div>
      )}

      {/* Actions */}
      {canEdit ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={reject}
            disabled={pending}
            className="btn-secondary justify-center text-[13px] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Rejeter
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={pending}
            className="btn-primary justify-center text-[13px] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Valider
          </button>
          {editing && !isPending && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="col-span-2 justify-center text-[12px] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              row.status === "approved"
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
            )}
          >
            {row.status === "approved" ? "Validée" : "Rejetée"}
            {row.reviewed_at ? ` · ${formatDateTime(row.reviewed_at)}` : ""}
          </span>
          <button
            type="button"
            onClick={() => { setChosen(row.photo_path_1); setEditing(true); }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-rose-700 ring-1 ring-rose-200/60 transition-colors hover:bg-rose-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier la décision
          </button>
        </div>
      )}
    </article>
  );
}
