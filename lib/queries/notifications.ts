import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

/** Une ligne = une campagne (regroupee par titre/corps/scenario). */
export type NotifCampaign = {
  scenario: string;
  title: string;
  body: string;
  deeplink: string | null;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  scheduled_at: string | null;
  created_at: string | null;
};

/** Historique agrege des campagnes (RPC cosme_check_admin_notif_history). */
export async function listNotifCampaigns(limit = 100): Promise<NotifCampaign[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_notif_history", { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data as NotifCampaign[];
}

export type NotifVariant = { title: string; body: string };
export type NotifScenario = {
  key: string;
  label: string;
  description: string | null;
  segment: string;
  deeplink: string | null;
  variants: NotifVariant[];
  priority: number;
  enabled: boolean;
  audience: number;
};
export type ScenariosState = { plannerEnabled: boolean; scenarios: NotifScenario[] };

/** Scenarios automatiques + flag maitre (RPC cosme_check_admin_notif_scenarios). */
export async function getNotifScenarios(): Promise<ScenariosState> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_notif_scenarios");
  if (error || !data) return { plannerEnabled: false, scenarios: [] };
  const res = data as { planner_enabled?: boolean; scenarios?: NotifScenario[] };
  return { plannerEnabled: Boolean(res.planner_enabled), scenarios: res.scenarios ?? [] };
}
