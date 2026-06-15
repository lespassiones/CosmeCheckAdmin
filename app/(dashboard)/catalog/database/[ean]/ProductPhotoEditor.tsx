"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { setCatalogImage, clearCatalogImage } from "./actions";

export function ProductPhotoEditor({ ean, imageUrl }: { ean: string; imageUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");

  function save() {
    startTransition(async () => {
      const r = await setCatalogImage(ean, url);
      if (r.ok) { toast.success("Photo mise à jour."); setUrl(""); }
      else toast.error(r.error);
    });
  }
  function clear() {
    startTransition(async () => {
      const r = await clearCatalogImage(ean);
      if (r.ok) toast.success("Photo retirée.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="flex items-start gap-4">
      {imageUrl ? (
        <Image src={imageUrl} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-black/[0.05]" unoptimized />
      ) : (
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400"><ImageOff className="h-7 w-7" /></span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[12px] text-muted-foreground">
          {imageUrl ? "Photo actuelle. Colle une nouvelle URL pour la remplacer." : "Aucune photo. Colle une URL d'image."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… (URL de l'image)"
            className="min-w-[220px] flex-1 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-rose-700 ring-1 ring-rose-200/60 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Retirer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
