"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshOpenAiCosts } from "./actions";

/** Force une resynchro des coûts OpenAI réels (API Costs) → openai_cost_daily. */
export function RefreshCostsButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshOpenAiCosts();
          if (r.ok) toast.success(`Coûts OpenAI synchronisés (${r.days} j).`);
          else toast.error(r.error);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-medium transition hover:bg-black/[0.04] disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Synchro…" : "Rafraîchir depuis OpenAI"}
    </button>
  );
}
