"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";

type SelectDef = { key: string; label: string; options: { value: string; label: string }[] };

const SELECTS: SelectDef[] = [
  { key: "photo", label: "Photo", options: [
    { value: "", label: "Photo : toutes" },
    { value: "with", label: "Avec photo" },
    { value: "without", label: "Sans photo" },
  ] },
  { key: "score", label: "Score", options: [
    { value: "", label: "Score : tous" },
    { value: "with", label: "Avec score" },
    { value: "without", label: "Sans score" },
  ] },
  { key: "inci", label: "INCI", options: [
    { value: "", label: "INCI : tous" },
    { value: "with", label: "Avec INCI" },
    { value: "without", label: "Sans INCI" },
  ] },
  { key: "source", label: "Source", options: [
    { value: "", label: "Source : toutes" },
    { value: "incibeauty", label: "Score INCI Beauty" },
    { value: "web", label: "Web / notre analyse" },
  ] },
  { key: "penalizing", label: "Pénalisants", options: [
    { value: "", label: "Pénalisants : tous" },
    { value: "with", label: "Avec pénalisants" },
    { value: "without", label: "Sans pénalisants" },
  ] },
  { key: "active", label: "Actif", options: [
    { value: "", label: "Statut : tous" },
    { value: "active", label: "Actifs" },
    { value: "inactive", label: "Inactifs" },
  ] },
  { key: "only_barcode", label: "Type", options: [
    { value: "", label: "Type : tous" },
    { value: "1", label: "Code-barre seul" },
  ] },
];

export function CatalogDbFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page"); // tout changement de filtre revient page 1
    startTransition(() => router.push(`/catalog/database?${sp.toString()}`));
  }

  return (
    <div className="mb-5 space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); apply({ q, category }); }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Marque ou nom…"
            className="w-full rounded-xl border border-black/[0.08] bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-rose-200"
          />
        </div>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Catégorie contient…"
          className="min-w-[160px] flex-1 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Filtrer
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {SELECTS.map((s) => (
          <select
            key={s.key}
            aria-label={s.label}
            value={params.get(s.key) ?? ""}
            onChange={(e) => apply({ [s.key]: e.target.value })}
            className="rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-rose-200"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
