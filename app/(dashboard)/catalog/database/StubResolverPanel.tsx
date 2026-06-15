"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check, X, RefreshCw } from "lucide-react";
import { resolveBarcode, type ResolveResult } from "./resolveActions";

/** Lance N tâches avec une concurrence bornée. */
async function runPool<T>(items: string[], worker: (e: string) => Promise<T>, concurrency: number, onEach: (r: T) => void) {
  let i = 0;
  async function next(): Promise<void> {
    const idx = i++;
    if (idx >= items.length) return;
    onEach(await worker(items[idx]));
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
}

export function StubResolverPanel({ eans }: { eans: string[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [ok, setOk] = useState<ResolveResult[]>([]);
  const [ko, setKo] = useState<ResolveResult[]>([]);

  async function run() {
    setRunning(true);
    setDone(0);
    setOk([]);
    setKo([]);
    await runPool(
      eans,
      (e) => resolveBarcode(e),
      3,
      (r) => {
        setDone((d) => d + 1);
        if (r.ok) setOk((a) => [...a, r]);
        else setKo((a) => [...a, r]);
      },
    );
    setRunning(false);
  }

  return (
    <div className="mb-5 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-amber-900">Produits « code-barre seul » ({eans.length} sur cette page)</p>
          <p className="text-[12px] text-amber-800/80">
            GPT cherche nom / marque / INCI / catégorie depuis le code-barre, calcule la note (+ blocus) et l'ajoute au catalogue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running && (ok.length + ko.length > 0) && (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-medium ring-1 ring-black/[0.08] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
            </button>
          )}
          <button
            type="button"
            onClick={run}
            disabled={running || eans.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? `Résolution… ${done}/${eans.length}` : `Résoudre cette page via GPT`}
          </button>
        </div>
      </div>

      {(ok.length > 0 || ko.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-emerald-200/50">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <Check className="h-4 w-4" /> Réussis ({ok.length})
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto text-[11px]">
              {ok.map((r) => r.ok && (
                <li key={r.ean} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{r.ean} · {r.brand ?? ""} {r.name ?? ""}</span>
                  <span className="shrink-0 font-semibold text-emerald-700">{r.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-rose-200/50">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
              <X className="h-4 w-4" /> Échoués ({ko.length})
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto text-[11px]">
              {ko.map((r) => !r.ok && (
                <li key={r.ean} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{r.ean}</span>
                  <span className="shrink-0 text-rose-600">{r.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
