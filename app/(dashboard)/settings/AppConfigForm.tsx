"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAppConfig } from "./actions";

export type AppConfig = {
  signup_default_tier: "free" | "premium";
  signups_open: boolean;
  flag_deep_search: boolean;
  flag_suggestions: boolean;
  flag_advisor: boolean;
  flag_public_share: boolean;
  flag_routine_reorganize: boolean;
  flag_conflicts: boolean;
  flag_skin_score: boolean;
  flag_weekly_picks: boolean;
  notif_reminders_enabled: boolean;
  notif_bilan_weekday: number;
  notif_bilan_hour: number;
  notif_conflict_alerts: boolean;
  ai_cost_alert_daily_usd: number | null;
  ai_cost_alert_monthly_usd: number | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
};

const WEEKDAYS = [
  { v: 1, label: "Lundi" },
  { v: 2, label: "Mardi" },
  { v: 3, label: "Mercredi" },
  { v: 4, label: "Jeudi" },
  { v: 5, label: "Vendredi" },
  { v: 6, label: "Samedi" },
  { v: 7, label: "Dimanche" },
];

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-black/[0.05] bg-white/60 p-3.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function AppConfigForm({ initial }: { initial: AppConfig }) {
  const [cfg, setCfg] = useState<AppConfig>(initial);
  const [dailyAlert, setDailyAlert] = useState(
    initial.ai_cost_alert_daily_usd != null ? String(initial.ai_cost_alert_daily_usd) : "",
  );
  const [monthlyAlert, setMonthlyAlert] = useState(
    initial.ai_cost_alert_monthly_usd != null ? String(initial.ai_cost_alert_monthly_usd) : "",
  );
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof AppConfig>(k: K, v: AppConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  function save() {
    startTransition(async () => {
      const r = await saveAppConfig({
        signup_default_tier: cfg.signup_default_tier,
        signups_open: cfg.signups_open,
        flag_deep_search: cfg.flag_deep_search,
        flag_suggestions: cfg.flag_suggestions,
        flag_advisor: cfg.flag_advisor,
        flag_public_share: cfg.flag_public_share,
        flag_routine_reorganize: cfg.flag_routine_reorganize,
        flag_conflicts: cfg.flag_conflicts,
        flag_skin_score: cfg.flag_skin_score,
        flag_weekly_picks: cfg.flag_weekly_picks,
        notif_reminders_enabled: cfg.notif_reminders_enabled,
        notif_bilan_weekday: cfg.notif_bilan_weekday,
        notif_bilan_hour: cfg.notif_bilan_hour,
        notif_conflict_alerts: cfg.notif_conflict_alerts,
        ai_cost_alert_daily_usd: dailyAlert.trim(),
        ai_cost_alert_monthly_usd: monthlyAlert.trim(),
        maintenance_mode: cfg.maintenance_mode,
        maintenance_message: cfg.maintenance_message ?? "",
      });
      if (r.ok) toast.success("Paramètres enregistrés.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* Inscription */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inscription
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.05] bg-white/60 p-3.5">
            <span>
              <span className="block text-[13px] font-medium">Tier par défaut des nouveaux inscrits</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Appliqué à la création du compte (trigger DB).
              </span>
            </span>
            <select
              value={cfg.signup_default_tier}
              onChange={(e) => set("signup_default_tier", e.target.value as "free" | "premium")}
              className="input-base !rounded-full !py-2 !px-4"
              disabled={pending}
            >
              <option value="free">free</option>
              <option value="premium">premium</option>
            </select>
          </div>
          <Toggle
            label="Inscriptions ouvertes"
            hint="Désactivé : la création de nouveaux comptes est bloquée (au niveau base)."
            checked={cfg.signups_open}
            onChange={(v) => set("signups_open", v)}
            disabled={pending}
          />
        </div>
      </section>

      {/* Feature flags */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fonctionnalités (feature flags)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle label="Recherche approfondie internet" checked={cfg.flag_deep_search} onChange={(v) => set("flag_deep_search", v)} disabled={pending} />
          <Toggle label="Suggestions intelligentes" checked={cfg.flag_suggestions} onChange={(v) => set("flag_suggestions", v)} disabled={pending} />
          <Toggle label="Beauty Advisor" checked={cfg.flag_advisor} onChange={(v) => set("flag_advisor", v)} disabled={pending} />
          <Toggle label="Partage public d'analyse" checked={cfg.flag_public_share} onChange={(v) => set("flag_public_share", v)} disabled={pending} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Lu par les apps via <code>cosme_check_get_app_config()</code>. Effet web immédiat ; mobile au prochain build.
        </p>
      </section>

      {/* Feature flags rétention (juil 2026) */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fonctionnalités rétention (mobile)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle label="Score de peau" hint="Carte accueil + page Ma peau + bilan hebdo + scan visage." checked={cfg.flag_skin_score} onChange={(v) => set("flag_skin_score", v)} disabled={pending} />
          <Toggle label="Pépites de la semaine" hint="Sélection hebdo de produits sur l'accueil." checked={cfg.flag_weekly_picks} onChange={(v) => set("flag_weekly_picks", v)} disabled={pending} />
          <Toggle label="Réorganiser ma routine" hint="Action de réorganisation matin/soir déterministe." checked={cfg.flag_routine_reorganize} onChange={(v) => set("flag_routine_reorganize", v)} disabled={pending} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Nécessite que l'app mobile embarque le code (build/OTA à jour). Le split routine matin/soir ne dépend pas d'un flag.
        </p>
      </section>

      {/* Notifications */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications (push)
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Rappels de bilan hebdo"
            hint="Push distant envoyé chaque semaine aux utilisateurs qui n'ont pas fait leur bilan."
            checked={cfg.notif_reminders_enabled}
            onChange={(v) => set("notif_reminders_enabled", v)}
            disabled={pending}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Jour du rappel</span>
              <select
                value={cfg.notif_bilan_weekday}
                onChange={(e) => set("notif_bilan_weekday", Number(e.target.value))}
                className="input-base !rounded-full !py-2 !px-4 w-full"
                disabled={pending || !cfg.notif_reminders_enabled}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.v} value={d.v}>{d.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Heure (Europe/Paris, 0-23)</span>
              <input
                type="number"
                min={0}
                max={23}
                value={cfg.notif_bilan_hour}
                onChange={(e) => set("notif_bilan_hour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                className="input-base !rounded-full !py-2 !px-4 w-full"
                disabled={pending || !cfg.notif_reminders_enabled}
              />
            </label>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Le rappel hebdo part via un cron horaire (Edge <code>send-weekly-bilan</code>) qui envoie à l'heure choisie. Nécessite un build mobile avec expo-notifications + credentials FCM/APNs.
        </p>
      </section>

      {/* AI cost alerts */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Alertes coûts IA (USD)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">Seuil quotidien ($)</span>
            <input type="number" min={0} step="0.5" value={dailyAlert} onChange={(e) => setDailyAlert(e.target.value)}
              placeholder="ex: 5" className="input-base !rounded-full !py-2 !px-4 w-full" disabled={pending} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">Seuil 30 jours ($)</span>
            <input type="number" min={0} step="1" value={monthlyAlert} onChange={(e) => setMonthlyAlert(e.target.value)}
              placeholder="ex: 100" className="input-base !rounded-full !py-2 !px-4 w-full" disabled={pending} />
          </label>
        </div>
      </section>

      {/* Maintenance */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mode maintenance
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Activer le mode maintenance"
            hint="Les apps peuvent afficher une bannière et bloquer les appels lourds."
            checked={cfg.maintenance_mode}
            onChange={(v) => set("maintenance_mode", v)}
            disabled={pending}
          />
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">Message affiché</span>
            <input
              type="text"
              value={cfg.maintenance_message ?? ""}
              onChange={(e) => set("maintenance_message", e.target.value)}
              placeholder="Maintenance en cours, revenez dans quelques minutes."
              className="input-base !rounded-full !py-2 !px-4 w-full"
              disabled={pending}
            />
          </label>
        </div>
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="btn-primary !px-6">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
