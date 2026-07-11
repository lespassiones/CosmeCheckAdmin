"use client";

import { useEffect, useState } from "react";
import { Bell, RotateCcw } from "lucide-react";

/**
 * Mockup realiste (ecran verrouille iOS) montrant comment la notification
 * apparait sur le telephone, avec une animation d'entree rejouable.
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

  // Rejoue l'animation quand le titre change (nouveau contenu = nouvelle "arrivee").
  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [title]);

  return (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes notif-in {
          0%   { opacity: 0; transform: translateY(-18px) scale(0.96); }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-anim { animation: notif-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      {/* Chassis */}
      <div className="relative w-[260px] rounded-[2.75rem] bg-neutral-900 p-2.5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-black/20">
        {/* Ecran */}
        <div className="relative h-[540px] overflow-hidden rounded-[2.25rem] bg-gradient-to-b from-rose-200 via-fuchsia-200 to-indigo-300">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-white/90">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-white/80" />
              <span className="inline-block h-2.5 w-3.5 rounded-[2px] bg-white/80" />
              <span className="inline-block h-2.5 w-5 rounded-[3px] bg-white/80" />
            </span>
          </div>

          {/* Horloge ecran verrouille */}
          <div className="relative z-10 mt-8 text-center text-white drop-shadow">
            <p className="text-[13px] font-medium opacity-90">mardi 11 juillet</p>
            <p className="-mt-1 text-[64px] font-bold leading-none tracking-tight">9:41</p>
          </div>

          {/* Notification */}
          <div className="absolute inset-x-3 top-[210px] z-10">
            <div
              key={playKey}
              className="notif-anim flex items-start gap-2.5 rounded-2xl bg-white/85 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur-xl"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow">
                <Bell className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {appName}
                  </span>
                  <span className="text-[10px] text-neutral-400">maintenant</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-neutral-900">
                  {title || "Titre de la notification"}
                </p>
                <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                  {body || "Le message apparaitra ici."}
                </p>
              </div>
            </div>
          </div>

          {/* Barre home */}
          <div className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-white/70" />
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
    </div>
  );
}
