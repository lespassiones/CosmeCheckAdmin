"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Sparkles, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { cn, formatInt } from "@/lib/utils";
import { pingOpenAi, pingMistral, type AiPingResult } from "./aiHealthActions";

type Provider = "openai" | "mistral";

type CardConfig = {
  provider: Provider;
  label: string;
  hint: string;
  run: () => Promise<AiPingResult>;
};

const PROVIDERS: CardConfig[] = [
  {
    provider: "openai",
    label: "OpenAI",
    hint: "gpt-4o-mini",
    run: pingOpenAi,
  },
  {
    provider: "mistral",
    label: "Mistral",
    hint: "mistral-small-latest",
    run: pingMistral,
  },
];

export function AiHealthChecks() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {PROVIDERS.map((p) => (
        <ProviderCard key={p.provider} config={p} />
      ))}
    </div>
  );
}

function ProviderCard({ config }: { config: CardConfig }) {
  const [result, setResult] = useState<AiPingResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await config.run();
      setResult(r);
      if (r.ok) {
        toast.success(
          `${config.label} OK · ${formatInt(r.latencyMs)} ms`,
          { description: r.reply.slice(0, 120) },
        );
      } else {
        toast.error(`${config.label} KO`, { description: r.error });
      }
    });
  }

  const status: "idle" | "loading" | "ok" | "ko" = pending
    ? "loading"
    : result === null
      ? "idle"
      : result.ok
        ? "ok"
        : "ko";

  return (
    <article
      className={cn(
        "neo-card p-5 transition-colors",
        status === "ok" && "ring-emerald-200/70",
        status === "ko" && "ring-rose-200/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Provider IA
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight">
            {config.label}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {config.hint}
          </p>
        </div>
        <StatusBadge status={status} latencyMs={result?.latencyMs} />
      </div>

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all",
          "bg-rose-500 text-white shadow-[0_4px_14px_-4px_rgba(244,63,94,0.5)]",
          "hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Test en cours…
          </>
        ) : (
          <>
            <PlugZap className="h-3.5 w-3.5" />
            Tester {config.label}
          </>
        )}
      </button>

      {result && !pending && (
        <div className="mt-4 border-t border-black/[0.04] pt-3">
          {result.ok ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Réponse · {formatInt(result.latencyMs)} ms
              </p>
              <p className="mt-1.5 line-clamp-3 text-[12px] italic text-foreground/80">
                « {result.reply} »
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider text-rose-600">
                Erreur{result.latencyMs ? ` · ${formatInt(result.latencyMs)} ms` : ""}
              </p>
              <p className="mt-1.5 line-clamp-3 text-[12px] text-rose-700">
                {result.error}
              </p>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function StatusBadge({
  status,
  latencyMs,
}: {
  status: "idle" | "loading" | "ok" | "ko";
  latencyMs?: number;
}) {
  if (status === "idle") {
    return (
      <span className="pill text-[11px] text-muted-foreground">
        Non testé
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span className="pill-amber text-[11px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        En cours
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="pill-emerald text-[11px] tabular-nums">
        <CheckCircle2 className="h-3 w-3" />
        Connecté{latencyMs !== undefined ? ` · ${formatInt(latencyMs)} ms` : ""}
      </span>
    );
  }
  return (
    <span className="pill-rose-tag text-[11px] tabular-nums">
      <XCircle className="h-3 w-3" />
      Erreur{latencyMs !== undefined ? ` · ${formatInt(latencyMs)} ms` : ""}
    </span>
  );
}
