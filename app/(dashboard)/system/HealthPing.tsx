"use client";

/**
 * Live health-check pinger for the main CosmetWiki app.
 *
 * Hits `${NEXT_PUBLIC_COSMECHECK_URL}/api/health` every 10 seconds from the
 * admin's browser (NOT the server), so this measures real-world latency from
 * wherever the admin is sitting.
 *
 * The target's /api/health must respond with CORS headers permissive enough
 * for the admin dashboard origin (or, alternatively, the route can be public
 * and same-origin-checkless). If the request is blocked by CORS, we surface
 * it as a "down" state, which is actually the correct user-facing signal.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "ok" | "down" | "loading";

const PING_INTERVAL_MS = 10_000;

function formatTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function HealthPing() {
  const [status, setStatus] = useState<Status>("loading");
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [target, setTarget] = useState<string>("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_COSMECHECK_URL || "https://www.cosme-check.com";
    setTarget(url);
    let cancelled = false;

    async function ping() {
      const t0 = performance.now();
      try {
        const r = await fetch(`${url}/api/health`, { cache: "no-store" });
        const ms = Math.round(performance.now() - t0);
        if (cancelled) return;
        setStatus(r.ok ? "ok" : "down");
        setLatency(ms);
        setLastCheck(new Date());
      } catch {
        if (cancelled) return;
        setStatus("down");
        setLatency(null);
        setLastCheck(new Date());
      }
    }

    void ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isOk = status === "ok";
  const isLoading = status === "loading";

  return (
    <article className="glass-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {/* Pulsing dot */}
          <span className="relative mt-1 grid h-3 w-3 place-items-center" aria-hidden>
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                isOk && "animate-ping bg-emerald-400",
                !isOk && !isLoading && "bg-rose-400",
                isLoading && "bg-slate-300",
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-3 w-3 rounded-full ring-2 ring-white",
                isOk && "bg-emerald-500",
                !isOk && !isLoading && "bg-rose-500",
                isLoading && "bg-slate-400",
              )}
            />
          </span>

          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Health check · CosmetWiki main app
            </p>
            <p className="font-mono text-[13px] text-foreground/90 break-all">
              {target ? `${target}/api/health` : "…"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {isLoading
                ? "Première vérification en cours…"
                : isOk
                  ? "Réponse 200 OK."
                  : "Pas de réponse ou statut non-200."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoading ? (
            <span className="pill">…</span>
          ) : isOk ? (
            <span className="pill-emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              UP
            </span>
          ) : (
            <span className="pill-rose-tag">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              DOWN
            </span>
          )}

          <span className="pill tabular-nums">
            {latency !== null ? `${latency} ms` : "— ms"}
          </span>

          <span className="pill tabular-nums text-muted-foreground">
            {formatTime(lastCheck)}
          </span>
        </div>
      </div>
    </article>
  );
}
