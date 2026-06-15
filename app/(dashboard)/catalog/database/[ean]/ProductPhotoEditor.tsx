"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { setCatalogImage, clearCatalogImage, uploadCatalogImage } from "./actions";

/** Compresse une image dans le navigateur → WebP ≤ 800px. On n'envoie QUE ça. */
async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression échouée"))), "image/webp", 0.8),
  );
}

export function ProductPhotoEditor({ ean, imageUrl }: { ean: string; imageUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    let blob: Blob;
    try {
      blob = await compressToWebp(file);
    } catch {
      toast.error("Impossible de lire/compresser cette image.");
      return;
    }
    const kb = Math.round(blob.size / 1024);
    const fd = new FormData();
    fd.append("ean", ean);
    fd.append("file", new File([blob], `${ean}.webp`, { type: "image/webp" }));
    startTransition(async () => {
      const r = await uploadCatalogImage(fd);
      if (r.ok) toast.success(`Photo importée et optimisée (${kb} Ko).`);
      else toast.error(r.error);
    });
  }

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
          {imageUrl ? "Photo actuelle. Importe depuis ton PC ou colle une URL pour la remplacer." : "Importe une image depuis ton PC, ou colle une URL."}
          {" "}L'image est compressée (WebP ≤ 800px) dans le navigateur — seule la version optimisée est stockée.
        </p>

        {/* Import depuis le PC (compressé client) */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Importer une image"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Importer depuis le PC
          </button>
        </div>

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
