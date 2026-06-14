"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, X, BarcodeIcon, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { findAndPromote, promoteWithEan, rejectWebProduct } from "./actions";
import { leafOf, type WebProductRow } from "@/lib/queries/webProducts";

export function WebProductCard({ product }: { product: WebProductRow }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);

  const title = [product.brand, product.name].filter(Boolean).join(" — ") || "Produit sans nom";
  const leaf = leafOf(product.category);
  const inci = product.ingredients_text ?? "";
  const inciPreview = inci.length > 160 && !expanded ? `${inci.slice(0, 160)}…` : inci;

  function runFind() {
    startTransition(async () => {
      const r = await findAndPromote(product.id);
      if (r.ok) toast.success(`Ajouté au catalogue · EAN ${r.ean}`);
      else toast.error(r.error);
    });
  }

  function runManual() {
    startTransition(async () => {
      const r = await promoteWithEan(product.id, manual);
      if (r.ok) toast.success(`Ajouté au catalogue · EAN ${r.ean}`);
      else toast.error(r.error);
    });
  }

  function runReject() {
    startTransition(async () => {
      const r = await rejectWebProduct(product.id);
      if (r.ok) toast.success("Produit écarté.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05] shadow-[0_4px_16px_-8px_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {leaf && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200/60">
                {leaf}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              vu {product.occurrences}×
            </span>
            {product.source_url && (
              <a
                href={product.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600"
              >
                <ExternalLink className="h-3 w-3" /> source
              </a>
            )}
          </div>
        </div>
      </div>

      {inci && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-left"
        >
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Liste INCI</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{inciPreview}</p>
          {inci.length > 160 && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-rose-600">
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
              {expanded ? "réduire" : "tout voir"}
            </span>
          )}
        </button>
      )}

      {product.description && (
        <div className="mt-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</p>
          <p className="mt-0.5 line-clamp-3 text-[12px] leading-relaxed text-slate-600">
            {product.description}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runFind}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Trouver l&apos;EAN (GPT)
        </button>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-slate-700 ring-1 ring-black/[0.08] transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <BarcodeIcon className="h-3.5 w-3.5" /> Saisir
        </button>
        <button
          type="button"
          onClick={runReject}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" /> Écarter
        </button>
      </div>

      {showManual && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="Code-barres EAN (13 chiffres)"
            className="flex-1 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="button"
            onClick={runManual}
            disabled={pending || manual.replace(/\D/g, "").length < 8}
            className="rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
