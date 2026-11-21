"use client";

import { useState, useTransition } from "react";
import { Calculator, Check, ExternalLink, ImageOff, Loader2, Mail, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { BrandSubmissionRow } from "@/lib/queries/brandSubmissions";
import { STAR_COLOR, STAR_LABEL, type StarCount } from "@/lib/brands/scoring";
import { cn, formatDateTime } from "@/lib/utils";
import { approveBrand, previewBrandScore, rejectBrand, reopenBrand, saveCheckNote, type Preview } from "./actions";

/**
 * Une fiche envoyée par une marque. Trois gestes :
 *   1. « Calculer la note » (rien n'est publié) ;
 *   2. « Mettre dans l'app et prévenir » ;
 *   3. « Refuser » (message facultatif à la marque).
 */
export function BrandSubmissionCard({ row }: { row: BrandSubmissionRow }) {
  const [pending, start] = useTransition();
  const [inci, setInci] = useState(row.inci);
  const [productName, setProductName] = useState(row.product_name);
  const [brand, setBrand] = useState(row.brand);
  const [category, setCategory] = useState("");
  const [preview, setPreview] = useState<Extract<Preview, { ok: true }> | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(row.check_note ?? "");
  const isPending = row.status === "pending";

  const field = "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-rose-300";

  function calc() {
    start(async () => {
      const r = await previewBrandScore({ id: row.id, inci, ean: row.ean ?? undefined });
      if (r.ok) setPreview(r);
      else toast.error(r.error);
    });
  }

  function approve() {
    start(async () => {
      const r = await approveBrand({ id: row.id, inci, productName, brand, ean: row.ean ?? undefined, category });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Dans l'app : ${r.stars}/5. ${r.notified ? "Marque prévenue par mail." : "Mail NON envoyé (clé Brevo ?)."}`);
    });
  }

  function reject() {
    start(async () => {
      const r = await rejectBrand({ id: row.id, reason });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.notified ? "Refusé, marque prévenue." : "Refusé (sans mail).");
    });
  }

  const canPublish = !!preview && (!preview.unreadable || !!preview.existing);

  return (
    <article className="neo-card overflow-hidden p-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground">{row.brand}</p>
          <h3 className="text-[16px] font-semibold leading-snug">{row.product_name}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {row.ean ? `EAN ${row.ean}` : "Sans code-barres"} · {row.volume}
            {row.product_type ? ` · ${row.product_type}` : ""}
            {row.made_in ? ` · ${row.made_in}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {row.zones.map((z) => (
              <span key={z} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/60">
                {z}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right text-[12px] text-muted-foreground">
          <p>{formatDateTime(row.created_at)}</p>
          <a href={`mailto:${row.contact_email}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-rose-700">
            <Mail className="h-3.5 w-3.5" />
            {row.contact_email}
          </a>
          {row.contact_name ? <p>{row.contact_name}</p> : null}
        </div>
      </div>

      {/* Photos + liens */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {[row.photo_front_url, row.photo_inci_url].map((url, i) =>
          url ? (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-xl ring-1 ring-black/[0.06] hover:ring-rose-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={i === 0 ? "Face" : "Ingrédients"} className="h-full w-full object-cover" />
            </a>
          ) : (
            <div key={i} className="grid h-24 w-24 place-items-center rounded-xl bg-muted text-muted-foreground" title="Pas de photo">
              <ImageOff className="h-5 w-5" />
            </div>
          ),
        )}
        <div className="flex flex-col gap-1.5 text-[13px]">
          {row.product_url ? (
            <a href={row.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Page produit
            </a>
          ) : (
            <span className="text-muted-foreground">Pas de page produit</span>
          )}
          {row.brand_website ? (
            <a href={row.brand_website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Site de la marque
            </a>
          ) : null}
        </div>
      </div>

      {row.properties ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-[12.5px] text-foreground/80">
          <span className="font-medium">Promesses : </span>
          {row.properties}
        </p>
      ) : null}

      {isPending ? (
        <>
          {/* Données à vérifier, modifiables */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className={field} placeholder="Nom" />
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={field} placeholder="Marque" />
          </div>
          <textarea
            value={inci}
            onChange={(e) => {
              setInci(e.target.value);
              setPreview(null);
            }}
            rows={4}
            className={cn(field, "mt-2 resize-y font-mono text-[12px]")}
          />
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={cn(field, "mt-2")} placeholder="Catégorie (slug de la taxonomie, facultatif)" />

          {/* Note de vérification interne */}
          <div className="mt-2 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Note de vérification (interne)" />
            {note !== (row.check_note ?? "") ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => void (await saveCheckNote({ id: row.id, note })))}
                className="btn-secondary shrink-0 text-[12px]"
              >
                Garder
              </button>
            ) : null}
          </div>

          {/* Résultat du calcul */}
          {preview ? <PreviewBox preview={preview} /> : null}

          {/* Actions */}
          {rejecting ? (
            <div className="mt-4 rounded-xl bg-muted/50 p-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className={cn(field, "resize-y")}
                placeholder="Message à la marque (facultatif). Vide = refus sans mail."
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setRejecting(false)} disabled={pending} className="btn-secondary flex-1 justify-center text-[13px]">
                  Annuler
                </button>
                <button type="button" onClick={reject} disabled={pending} className="btn-primary flex-1 justify-center bg-slate-800 text-[13px]">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  {reason.trim() ? "Refuser et prévenir" : "Refuser"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
              <button type="button" onClick={() => setRejecting(true)} disabled={pending} className="btn-secondary justify-center text-[13px]">
                <X className="h-4 w-4" /> Refuser
              </button>
              <button type="button" onClick={calc} disabled={pending || inci.trim().length < 10} className="btn-secondary justify-center text-[13px]">
                {pending && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                1. Calculer la note
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={pending || !canPublish}
                title={canPublish ? undefined : "Calcule la note d'abord"}
                className="btn-primary justify-center text-[13px] disabled:opacity-40"
              >
                {pending && preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                2. Mettre dans l&apos;app et prévenir
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-medium ring-1",
                row.status === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60" : "bg-slate-100 text-slate-600 ring-slate-200/60",
              )}
            >
              {row.status === "approved" ? "Dans l'app" : "Refusé"}
              {row.reviewed_at ? ` · ${formatDateTime(row.reviewed_at)}` : ""}
            </span>
            {row.stars ? <Stars n={row.stars as StarCount} /> : null}
            <span className="text-muted-foreground">{row.notified_at ? "Marque prévenue" : "Sans mail"}</span>
            {row.review_note ? <span className="text-muted-foreground">« {row.review_note} »</span> : null}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => void (await reopenBrand(row.id)))}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-muted-foreground ring-1 ring-black/10 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Rouvrir
          </button>
        </div>
      )}
    </article>
  );
}

function Stars({ n }: { n: StarCount }) {
  return (
    <span className="text-[15px] tracking-[1px]" style={{ color: STAR_COLOR[n] }} aria-label={`${n} sur 5`}>
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function PreviewBox({ preview }: { preview: Extract<Preview, { ok: true }> }) {
  const c = preview.computed;
  return (
    <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3 text-[13px]">
      {c ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars n={c.stars} />
          <span className="font-semibold">{STAR_LABEL[c.stars]}</span>
          <span className="text-muted-foreground">
            {c.score.toFixed(1)}/20 · {c.identPct} % reconnus · {c.nVert} V, {c.nJaune} J, {c.nOrange} O, {c.nRouge} R
          </span>
        </div>
      ) : (
        <p className="font-medium text-rose-700">Moins de 50 % des ingrédients reconnus : composition à corriger avant de publier.</p>
      )}
      {c && c.identPct < 90 ? (
        <p className="text-amber-700">Moins de 90 % reconnus : vérifier l&apos;orthographe de la liste.</p>
      ) : null}
      {preview.existing ? (
        <p className="text-amber-700">
          Déjà dans l&apos;app ({preview.existing.brand} {preview.existing.name}) avec <Stars n={preview.existing.stars} /> : c&apos;est cette note qui
          sera gardée et envoyée.
          {preview.existing.sameComposition ? "" : " La composition de la marque est différente de celle de l'app."}
        </p>
      ) : null}
    </div>
  );
}
