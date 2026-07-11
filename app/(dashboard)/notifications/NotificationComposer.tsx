"use client";

import { useState, useTransition } from "react";
import { Send, Eye, TestTube2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  previewAudience,
  sendCampaign,
  sendTest,
  type AudienceSample,
} from "./actions";
import { PhoneNotificationPreview } from "./PhoneNotificationPreview";

const SEGMENTS: { value: string; label: string; hint: string }[] = [
  { value: "all", label: "Tous (joignables)", hint: "Tous les utilisateurs avec notifications activees" },
  { value: "free", label: "Gratuits", hint: "Tier free" },
  { value: "premium", label: "Premium", hint: "Tier premium" },
  { value: "inactive_7d", label: "Inactifs 7 j", hint: "Aucun scan depuis 7 jours" },
  { value: "inactive_14d", label: "Inactifs 14 j", hint: "Aucun scan depuis 14 jours" },
  { value: "inactive_30d", label: "Inactifs 30 j", hint: "Aucun scan depuis 30 jours" },
  { value: "no_scan", label: "Jamais scanne", hint: "Inscrits sans aucune analyse" },
  { value: "no_routine", label: "Sans routine", hint: "Ont scanne mais routine vide" },
];

const DEEPLINKS: { value: string; label: string }[] = [
  { value: "", label: "Aucun (ouvre l'app)" },
  { value: "/(tabs)", label: "Accueil" },
  { value: "/(tabs)/routine", label: "Ma routine" },
];

const input =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-rose-300";
const lbl = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

export function NotificationComposer() {
  const [pending, start] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [segment, setSegment] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [audience, setAudience] = useState<{ total: number; sample: AudienceSample[] } | null>(null);

  const segHint = SEGMENTS.find((s) => s.value === segment)?.hint ?? "";

  function runPreview() {
    startPreview(async () => {
      const r = await previewAudience(segment);
      if (r.ok) {
        setAudience({ total: r.total, sample: r.sample });
        toast.success(`${r.total} destinataire(s) joignable(s).`);
      } else {
        toast.error(r.error);
      }
    });
  }

  function runTest() {
    start(async () => {
      const r = await sendTest({ title, body, deeplink });
      if (r.ok) toast.success("Test envoye sur ton appareil.");
      else toast.error(r.error);
    });
  }

  function runSend() {
    const isScheduled = scheduledAt.trim().length > 0;
    start(async () => {
      const r = await sendCampaign({
        segment,
        title,
        body,
        deeplink,
        scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null,
        dispatchNow: !isScheduled,
      });
      if (r.ok) {
        toast.success(isScheduled ? "Campagne programmee." : "Campagne envoyee.");
        setTitle("");
        setBody("");
        setAudience(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Composer */}
      <article className="neo-card p-5 lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Audience</label>
            <select className={input} value={segment} onChange={(e) => { setSegment(e.target.value); setAudience(null); }}>
              {SEGMENTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">{segHint}</p>
          </div>
          <div>
            <label className={lbl}>Action au tap</label>
            <select className={input} value={deeplink} onChange={(e) => setDeeplink(e.target.value)}>
              {DEEPLINKS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Titre</label>
            <input
              className={input}
              maxLength={80}
              placeholder="Ex : Un nouveau produit dans ta salle de bain ?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Message</label>
            <textarea
              className={`${input} min-h-[80px] resize-y`}
              maxLength={180}
              placeholder="Ex : Verifie sa composition en 10 secondes."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{body.length}/180</p>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Programmer (optionnel)</label>
            <input
              className={input}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vide = envoi immediat. Sinon la campagne part au prochain passage du cron (toutes les 15 min).
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={previewing}
            onClick={runPreview}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-semibold text-foreground transition hover:bg-black/5 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            {previewing ? "Calcul…" : "Previsualiser l'audience"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={runTest}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-semibold text-foreground transition hover:bg-black/5 disabled:opacity-50"
          >
            <TestTube2 className="h-4 w-4" />
            Test sur moi
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={runSend}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {pending ? "Envoi…" : scheduledAt.trim() ? "Programmer" : "Envoyer maintenant"}
          </button>
        </div>
      </article>

      {/* Apercu + audience */}
      <div className="flex flex-col gap-4">
        <article className="neo-card p-5">
          <p className={`${lbl} mb-3`}>Apercu sur le telephone</p>
          <PhoneNotificationPreview title={title} body={body} />
        </article>

        <article className="neo-card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <p className="text-[13px] font-semibold">
              {audience ? `${audience.total} destinataire(s)` : "Audience non calculee"}
            </p>
          </div>
          {audience && audience.sample.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {audience.sample.map((s) => (
                <li key={s.user_id} className="truncate text-[12px] text-muted-foreground">
                  {s.first_name ? `${s.first_name} · ` : ""}{s.email ?? s.user_id}
                </li>
              ))}
              {audience.total > audience.sample.length && (
                <li className="text-[11px] text-muted-foreground">
                  + {audience.total - audience.sample.length} autre(s)…
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Clique « Previsualiser l'audience » pour voir qui recevra la notification (uniquement les appareils avec notifications activees).
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
