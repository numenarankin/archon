import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrl } from "@/lib/env";

/**
 * Proxy (Next.js 16's renamed Middleware). Runs before every matched request to:
 *  1. refresh the Supabase auth session cookie, and
 *  2. perform an OPTIMISTIC redirect to /auth for signed-out users.
 *
 * Per the Next docs, Proxy is an optimistic gate only — the real boundary is
 * RLS at the database plus `requireUser()` in the Data Access Layer. This keeps
 * unauthenticated traffic out of the app cheaply and refreshes tokens.
 */

// Reachable without a session. Everything else requires auth. `/auth` also
// covers `/auth/callback` (the email-confirmation landing), which must be
// reachable before the session cookie exists. `/api/tiles` serves public RRC
// well-position vector tiles (coordinates only) for the map; keeping it public
// avoids any cookie dependency for Mapbox tile requests. The /map page itself
// stays auth-gated.
const PUBLIC_PATHS = ["/auth", "/api/tiles", "/operators.json"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(request: NextRequest) {
  // Response we can attach refreshed auth cookies to.
  let response = NextResponse.next({ request });

  const url = getSupabaseUrl();
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase isn't configured, don't lock the app out — just pass through.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() re-validates the token and triggers the cookie refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.search = "";
    // Remember where they were headed so /auth can send them back after login.
    if (pathname !== "/") {
      redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
