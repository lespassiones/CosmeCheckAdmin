/**
 * Append an entry to cosme_check.admin_audit_log. Forensic trail for every
 * destructive write performed via the dashboard.
 *
 * Best-effort: a failure to log MUST NOT break the user-facing action.
 */
import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "./supabase";

export type AuditEntry = {
  /** Authenticated admin's email — caller passes it from requireAdmin(). */
  adminEmail: string;
  /** Dot-namespaced action, e.g. "credits.set_limit", "user.suspend". */
  action: string;
  /** Optional UUID of the user the action affected. */
  targetUserId?: string | null;
  /** Optional payload (action params, result, etc.). Stored as JSONB. */
  payload?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const admin = supabaseAdmin();
    await admin
      .schema("cosme_check")
      .from("admin_audit_log")
      .insert({
        admin_email: entry.adminEmail,
        action: entry.action,
        target_user_id: entry.targetUserId ?? null,
        payload: entry.payload ?? null,
        ip,
      });
  } catch {
    // Never throw — auditing is best-effort.
  }
}
