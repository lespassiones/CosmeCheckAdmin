/**
 * Supabase clients for the admin dashboard.
 *
 *   - supabaseAdmin()   → service_role, bypass RLS, FULL access. Server-only.
 *   - supabaseServer()  → reads cookies, used for the admin's own session.
 *   - supabaseBrowser() → for client components that need the user's session.
 *
 * NEVER export supabaseAdmin to a client component. The service_role key
 * grants god-mode access to every row in the database.
 */
import "server-only";
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

let _admin: SupabaseClient | undefined;

/** Service-role client. God mode. SERVER ONLY. */
export function supabaseAdmin(): SupabaseClient {
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing — server only.");
  }
  if (!_admin) {
    _admin = createClient(url!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    });
  }
  return _admin;
}

/** Server-side client that reads the admin's session from cookies. */
export function supabaseServer(cookieStore: {
  get(name: string): { value: string } | undefined;
  set?(name: string, value: string, options: CookieOptions): void;
}) {
  return createServerClient(url!, anonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set?.(name, value, options);
        } catch {
          // Server components can't set cookies — fine.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set?.(name, "", { ...options, maxAge: 0 });
        } catch {
          // ignore
        }
      },
    },
  });
}
