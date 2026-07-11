/**
 * Page « Croissance » — funnel d'activation, rétention, stats globales.
 * Tout est calculé en UNE requête SQL (RPC cosme_check_admin_growth) : rapide,
 * pas de piège de pagination, comptes de test exclus côté SQL.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type GrowthData = {
  days: number;
  funnel: {
    signups: number;
    onboarding: number;
    first_scan: number;
    routine: number;
    premium: number;
  };
  retention: {
    d1_eligible: number;
    d1_retained: number;
    d7_eligible: number;
    d7_retained: number;
    d30_eligible: number;
    d30_retained: number;
  };
  stats: {
    scans: number;
    scanners: number;
    routine_items: number;
    routine_users: number;
    promesses: number;
    advisor_messages: number;
    credits_used: number;
    premium_total: number;
  };
};

const EMPTY: GrowthData = {
  days: 30,
  funnel: { signups: 0, onboarding: 0, first_scan: 0, routine: 0, premium: 0 },
  retention: { d1_eligible: 0, d1_retained: 0, d7_eligible: 0, d7_retained: 0, d30_eligible: 0, d30_retained: 0 },
  stats: { scans: 0, scanners: 0, routine_items: 0, routine_users: 0, promesses: 0, advisor_messages: 0, credits_used: 0, premium_total: 0 },
};

export async function fetchGrowth(days: number): Promise<GrowthData> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cosme_check_admin_growth", { p_days: days });
  if (error || !data) {
    // JAMAIS silencieux : des zéros muets ont déjà masqué une vraie panne
    // (pg-safeupdate rejetait le DELETE sans WHERE de la RPC via l'API).
    console.error("[growth] RPC cosme_check_admin_growth a échoué:", error?.message);
    return { ...EMPTY, days };
  }
  return data as GrowthData;
}
