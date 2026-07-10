"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authGuard";
import { logAudit } from "@/lib/audit";

export type InviteResult =
  | { ok: true; invited: number; failed: number; remaining: number }
  | { ok: false; error: string };

/**
 * Déclenche l'envoi des invitations bêta en appelant le main app
 * (POST /api/beta/invite), protégé par le secret partagé. L'admin n'a pas
 * d'infra email : c'est le main app (clé Brevo) qui envoie réellement.
 */
export async function sendBetaInvites(): Promise<InviteResult> {
  const admin = await requireAdmin();

  const base = (process.env.BETA_MAIN_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = process.env.BETA_INVITE_SECRET;
  if (!base) return { ok: false, error: "BETA_MAIN_APP_URL manquant." };
  if (!secret) return { ok: false, error: "BETA_INVITE_SECRET manquant." };

  try {
    const res = await fetch(`${base}/api/beta/invite`, {
      method: "POST",
      headers: {
        "x-beta-invite-secret": secret,
        // UA explicite : le middleware du main app refuse un UA vide et bloque
        // certains UA « bots » sur /api/*.
        "user-agent": "CosmeCheckAdmin/1.0",
        "content-type": "application/json",
      },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | { ok: true; invited: number; failed: number; remaining: number }
      | { ok: false; error?: string }
      | null;

    if (!res.ok || !json || !json.ok) {
      const err = (json && "error" in json && json.error) || `Erreur ${res.status}`;
      return { ok: false, error: err };
    }

    await logAudit({
      adminEmail: admin.email,
      action: "beta.invite",
      payload: { invited: json.invited, failed: json.failed, remaining: json.remaining },
    });

    revalidatePath("/beta");
    return { ok: true, invited: json.invited, failed: json.failed, remaining: json.remaining };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de l'appel au main app." };
  }
}
