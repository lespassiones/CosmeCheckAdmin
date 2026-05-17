"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { purgeAiCache, purgeProductInciCache } from "./actions";

type PurgeTarget = "ai_cache" | "product_inci_cache";

const LABELS: Record<PurgeTarget, { button: string; success: string; description: string }> = {
  ai_cache: {
    button: "Purger ai_cache",
    success: "Cache IA purgé.",
    description:
      "Vide intégralement la table cosme_check.ai_cache. Tous les appels IA suivants seront recalculés.",
  },
  product_inci_cache: {
    button: "Purger product_inci_cache",
    success: "Cache web-search purgé.",
    description:
      "Vide intégralement la table cosme_check.product_inci_cache. Les prochaines recherches produit refront un appel upstream.",
  },
};

export function PurgeCacheButton({ target }: { target: PurgeTarget }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const meta = LABELS[target];

  function handlePurge() {
    if (confirm !== "PURGE") {
      toast.error("Tape PURGE pour confirmer.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("confirm", "PURGE");
      const r = target === "ai_cache"
        ? await purgeAiCache(fd)
        : await purgeProductInciCache(fd);
      if (r.ok) {
        toast.success(meta.success);
        setConfirm("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <details className="group">
      <summary className="btn-danger cursor-pointer justify-center list-none">
        <Trash2 className="h-4 w-4" />
        {meta.button}
      </summary>
      <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 ring-1 ring-rose-200/60">
        <p className="text-[12px] text-rose-700">
          {meta.description} Cette action est <strong>irréversible</strong>. Tape{" "}
          <code className="font-mono">PURGE</code> pour confirmer.
        </p>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="PURGE"
          className="input-base !py-2 !text-[13px]"
          disabled={pending}
        />
        <button
          type="button"
          onClick={handlePurge}
          disabled={pending || confirm !== "PURGE"}
          className="btn-danger w-full disabled:opacity-50"
        >
          {pending ? "Purge…" : "Confirmer la purge"}
        </button>
      </div>
    </details>
  );
}
