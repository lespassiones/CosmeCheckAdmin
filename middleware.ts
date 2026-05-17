import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware-level auth gate.
 *
 * Refuses requests that are NOT either:
 *   - on a public auth route (/auth/sign-in, /auth/sign-up, /auth/callback)
 *   - or carrying a valid Supabase session whose email is in ADMIN_EMAILS.
 *
 * The Supabase cookie is also refreshed in-flight so the session doesn't
 * expire mid-navigation.
 */

const PUBLIC_PREFIXES = ["/auth/sign-in", "/auth/sign-up", "/auth/callback"];

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );

  const { data } = await sb.auth.getUser();
  const email = data.user?.email?.toLowerCase() ?? null;
  const allowed = email !== null && getAdminEmails().includes(email);

  if (!allowed) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Run on every request EXCEPT Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js)$).*)",
  ],
};
