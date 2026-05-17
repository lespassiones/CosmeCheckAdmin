"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { batchExplain } from "./actions";

/**
 * Placeholder client button for the "Générer explications AI" batch job.
 *
 * The server action currently returns `{ ok: false, error: "Feature coming
 * soon" }` — we surface it as an informational toast rather than an error
 * to make clear the feature is pending implementation, not broken.
 */
export function BatchExplainButton({ missing }: { missing: number }) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await batchExplain();
      if (r.ok) {
        toast.success("Génération lancée");
      } else {
        toast.message(r.error, {
          description: `Pour ${missing.toLocaleString("fr-FR")} ingrédient(s) sans explication. La pipeline AI sera ajoutée dans une prochaine itération.`,
        });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="btn-primary !py-2 !px-4 !text-[13px]"
    >
      <Wand2 className="h-3.5 w-3.5" />
      {pending ? "…" : "Générer explications"}
    </button>
  );
}
