"use client";

import { useEffect, useState } from "react";
import { Bell, RotateCcw } from "lucide-react";

/**
 * Mockup ecran verrouille iPhone. Les PROPORTIONS de la notification suivent
 * l'iOS reel (mesure sur un iPhone : banniere ~95% de la largeur ecran, icone
 * ~10% de la largeur, titre/corps petits, corps limite a 2 lignes, posee en
 * BAS de l'ecran verrouille comme sur iOS 16+). Demande produit : la notif
 * doit avoir sa taille reelle, pas une taille de demo gonflee.
 */
export function PhoneNotificationPreview({
  title,
  body,
  appName = "Cosme Check",
}: {
  title: string;
  body: string;
  appName?: string;
}) {
  const [playKey, setPlayKey] = useState(0);

  // Rejoue l'animation quand le contenu change (nouvelle "arrivee").
  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [title, body]);

  return (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes notif-in {
          0%   { opacity: 0; transform: translateY(14px) scale(0.97); }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-anim { animation: notif-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      {/* Chassis (~iPhone 15 : ratio ecran ≈ 2.16) */}
      <div className="relative w-[320px] rounded-[3rem] bg-neutral-900 p-2.5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-black/20">
        {/* Ecran */}
        <div className="relative h-[650px] overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-rose-200 via-fuchsia-200 to-indigo-300">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-white/90">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-white/80" />
              <span className="inline-block h-2.5 w-3.5 rounded-[2px] bg-white/80" />
              <span className="inline-block h-2.5 w-5 rounded-[3px] bg-white/80" />
            </span>
          </div>

          {/* Horloge ecran verrouille */}
          <div className="relative z-10 mt-10 text-center text-white drop-shadow">
            <p className="text-[14px] font-medium opacity-90">vendredi 11 juillet</p>
            <p className="-mt-1 text-[72px] font-bold leading-none tracking-tight">9:41</p>
          </div>

          {/* Notification — taille et position REELLES iOS : bandeau ~95% de
              large, icone 32px, titre/corps 11-12px, corps 2 lignes max,
              posee en bas de l'ecran verrouille (iOS 16+). */}
          <div className="absolute inset-x-2 bottom-12 z-10">
            <div
              key={playKey}
              className="notif-anim flex items-center gap-2 rounded-[18px] bg-white/80 px-2.5 py-2 shadow-md ring-1 ring-black/5 backdrop-blur-xl"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-gradient-to-br from-rose-500 to-rose-600 text-white">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[11.5px] font-semibold leading-tight text-neutral-900">
                    {title || "Titre de la notification"}
                  </p>
                  <span className="shrink-0 text-[9.5px] text-neutral-500">maintenant</span>
                </div>
                <p className="line-clamp-2 text-[11px] leading-[1.35] text-neutral-700">
                  {body || "Le message apparaitra ici."}
                </p>
              </div>
            </div>
          </div>

          {/* Barre home */}
          <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-white/70" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPlayKey((k) => k + 1)}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:bg-black/5"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Rejouer l&apos;animation
      </button>
      <span className="sr-only">{appName}</span>
    </div>
  );
}
