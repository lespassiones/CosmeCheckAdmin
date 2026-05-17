import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merge helper. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "1 234" — French-style thousands separator, no decimals. */
export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

/** "1 234.56 €" */
export function formatEUR(n: number | null | undefined, fractionDigits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** "$0.0123" — for tiny costs (LLM tokens), 4 decimals. */
export function formatUSD(n: number | null | undefined, fractionDigits = 4): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** "il y a 5 minutes" — relative French time. */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `il y a ${day} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** "17 mai 2026 · 14:32" */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
