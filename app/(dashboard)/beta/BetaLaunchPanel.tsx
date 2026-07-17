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
      <h3 className="text-[15px] font-semibold">Invitations bêta (automatiques)</h3>
      <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
        L&apos;email d&apos;accès part désormais <strong>automatiquement</strong> dès qu&apos;une
        personne s&apos;inscrit sur <code>/beta</code> — tu n&apos;as plus besoin de cliquer.
        Ce bouton ne sert plus qu&apos;en secours : il (re)envoie l&apos;email d&apos;accès aux
        inscrits encore « en attente » (ex. un envoi automatique qui a échoué). Idempotent :
        une même personne n&apos;est jamais invitée deux fois.
      </p>

      <div className="mt-4">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending === 0 || isPending}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Renvoyer aux inscrits en attente ({pending})
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
