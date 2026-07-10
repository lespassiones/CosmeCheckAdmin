"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendBetaInvites } from "./actions";

/**
 * Bouton « Envoyer les invitations (N) » : déclenche l'envoi des emails d'accès
 * aux inscrits en attente via le main app. Double-clic de confirmation pour
 * éviter un envoi accidentel. Résultat affiché en clair (+ toast best-effort).
 */
export function BetaLaunchPanel({ pending }: { pending: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function launch() {
    setMsg(null);
    startTransition(async () => {
      const r = await sendBetaInvites();
      if (!r.ok) {
        setMsg({ kind: "err", text: r.error });
        setConfirming(false);
        return;
      }
      const parts = [`${r.invited} invitation(s) envoyée(s)`];
      if (r.failed) parts.push(`${r.failed} échec(s)`);
      if (r.remaining) parts.push(`${r.remaining} encore en attente`);
      setMsg({ kind: "ok", text: parts.join(" · ") });
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <article className="neo-card mb-8 p-5">
      <h3 className="text-[15px] font-semibold">Lancer la phase de bêta test</h3>
      <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
        Envoie l&apos;email d&apos;accès (+ lien du formulaire de retour) à tous les inscrits
        pas encore invités. Idempotent : une même personne n&apos;est jamais invitée deux fois.
        Tu peux relancer le bouton pour de nouvelles vagues d&apos;inscription.
      </p>

      <div className="mt-4">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending === 0 || isPending}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Envoyer les invitations ({pending})
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">Envoyer à {pending} inscrit(s) ?</span>
            <button
              type="button"
              onClick={launch}
              disabled={isPending}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {isPending ? "Envoi…" : "Confirmer l'envoi"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded-xl bg-white px-4 py-2.5 text-[13px] font-medium ring-1 ring-black/10 transition-colors hover:bg-black/5 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p
          className={`mt-3 text-[13px] font-medium ${
            msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.kind === "ok" ? "✓ " : "⚠ "}
          {msg.text}
        </p>
      )}
    </article>
  );
}
