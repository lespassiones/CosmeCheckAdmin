import { Info } from "lucide-react";

/**
 * Petit « i » explicatif : au survol (ou focus clavier) affiche une bulle
 * décrivant ce que fait la section. 100% CSS (group-hover / focus-within),
 * donc utilisable dans un Server Component sans "use client".
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        role="button"
        aria-label={text}
        className="ml-1.5 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-muted-foreground/50 outline-none transition-colors hover:text-muted-foreground focus:text-muted-foreground focus:ring-1 focus:ring-rose-300"
      >
        <Info className="h-3.5 w-3.5" />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-6 z-50 hidden w-64 rounded-lg bg-[#111827] px-3 py-2 text-[12px] font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
