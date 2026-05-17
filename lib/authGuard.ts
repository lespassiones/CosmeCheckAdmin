/**
 * Authentication helpers for the admin dashboard.
 *
 * Rules:
 *   - The dashboard accepts a session iff the user's email is in ADMIN_EMAILS.
 *   - There can only be ONE admin user provisioned (gated by `hasAdmin()`).
 *     After the first sign-up, the sign-up form is hidden — the operator
 *     must add another email to ADMIN_EMAILS (and remove the existing
 *     admin or accept multi-admin) to enroll someone else.
 *
 * `requireAdmin()` is the gate used by every server component / action that
 * touches sensitive data. It redirects to /auth/sign-in when the visitor
 * is not authenticated or not in the allowlist.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "./supabase";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Returns the current admin session, or null. Doesn't redirect.
 * Use this in pages that need optional auth info.
 */
export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();
  const sb = supabaseServer(cookieStore);
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Redirects to /auth/sign-in if no valid admin session. Call this at the
 * top of every protected page (Server Components only — never in client).
 */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const admin = await getAdminUser();
  if (!admin) redirect("/auth/sign-in");
  return admin;
}

/**
 * "Has at least one admin already signed up?" — used by the sign-up flow
 * to lock down further enrollment after the first install.
 *
 * Counts auth users whose email is in the allowlist. If the count is > 0,
 * additional sign-ups are refused.
 */
export async function hasAdmin(): Promise<boolean> {
  const allow = getAdminEmails();
  if (allow.length === 0) return false;
  const admin = supabaseAdmin();
  // Use the Admin API to list users (cheap on a single-admin install).
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error || !data) return false;
  return data.users.some((u) => u.email && allow.includes(u.email.toLowerCase()));
}
