"use client";

import { useState, useTransition } from "react";
import { Check, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { approvePhotoSubmission, rejectPhotoSubmission } from "./actions";
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

  const photos = [
    { path: row.photo_path_1, url: row.photo_url_1 },
    ...(row.photo_path_2 && row.photo_url_2
      ? [{ path: row.photo_path_2, url: row.photo_url_2 }]
      : []),
  ];

  const isPending = row.status === "pending";

  function approve() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("submission_id", row.id);
      fd.append("photo_path", chosen);
      const r = await approvePhotoSubmission(fd);
      if (r.ok) toast.success("Photo validée et liée au produit.");
      else toast.error(r.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("submission_id", row.id);
      const r = await rejectPhotoSubmission(fd);
      if (r.ok) toast.success("Photo rejetée.");
      else toast.error(r.error);
    });
  }

  return (
    <article className="neo-card overflow-hidden p-4">
      {/* Photos */}
      <div className="flex gap-3">
        {photos.map((p, i) => {
          const selected = isPending && chosen === p.path;
          return (
            <button
              key={i}
              type="button"
              onClick={() => isPending && setChosen(p.path)}
              disabled={!isPending}
              className={cn(
                "relative aspect-square w-1/2 overflow-hidden rounded-xl ring-2 transition",
                selected ? "ring-rose-500" : "ring-black/[0.06]",
                isPending && "cursor-pointer hover:ring-rose-300",
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

      {/* Actions */}
      {isPending ? (
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
        </div>
      ) : (
        <div className="mt-3">
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
        </div>
      )}
    </article>
  );
}
