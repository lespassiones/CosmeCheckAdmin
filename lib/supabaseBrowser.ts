"use client";

/**
 * Browser-side Supabase client. Used for sign-in / sign-up forms and any
 * realtime subscriptions. Never exposes the service_role key.
 */
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function supabaseBrowser() {
  return createBrowserClient(url, anonKey);
}
