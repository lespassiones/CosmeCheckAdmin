"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase";
import { hasAdmin, isAdminEmail } from "@/lib/authGuard";

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * First-time admin enrolment. Allowed iff:
 *   1. No admin user exists in auth.users yet for any allowlisted email.
 *   2. The submitted email is on the ADMIN_EMAILS allowlist.
 *
 * Creates the user via the Admin API so we can SKIP email confirmation
 * (the user wanted "pas besoin de faire une confirmation du mail"). The
 * Supabase project's "Confirm email" toggle is irrelevant here because the
 * Admin API bypasses it when `email_confirm: true` is passed.
 */
export async function adminSignUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();

  if (!email.includes("@")) return { ok: false, error: "Email invalide." };
  if (password.length < 10) return { ok: false, error: "Mot de passe trop court (10 caractères minimum)." };
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Le mot de passe doit contenir minuscule + majuscule + chiffre." };
  }

  if (!isAdminEmail(email)) {
    return { ok: false, error: "Email non autorisé pour l'admin." };
  }
  if (await hasAdmin()) {
    return { ok: false, error: "Un compte admin existe déjà. Connecte-toi à la place." };
  }

  // Bypass email confirmation explicitly.
  const admin = supabaseAdmin();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName || "Admin" },
  });
  if (createErr) return { ok: false, error: createErr.message };

  // Sign the new admin in.
  const cookieStore = await cookies();
  const sb = supabaseServer(cookieStore);
  const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
  if (signInErr) return { ok: false, error: signInErr.message };

  redirect("/");
}

export async function adminSignIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { ok: false, error: "Email invalide." };
  if (password.length < 1) return { ok: false, error: "Mot de passe requis." };

  if (!isAdminEmail(email)) {
    return { ok: false, error: "Email non autorisé pour l'admin." };
  }

  const cookieStore = await cookies();
  const sb = supabaseServer(cookieStore);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Email ou mot de passe incorrect." };

  redirect("/");
}

export async function adminSignOut(): Promise<void> {
  const cookieStore = await cookies();
  const sb = supabaseServer(cookieStore);
  await sb.auth.signOut();
  redirect("/auth/sign-in");
}
