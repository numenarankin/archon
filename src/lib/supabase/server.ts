import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrl } from "@/lib/env";

/**
 * Request-scoped Supabase client bound to the signed-in user's session cookies.
 *
 * Uses the **publishable** (anon) key + the user's JWT from cookies, so every
 * query runs as that user and **Row Level Security applies**. This is the
 * default client for all data access (server components, server actions, route
 * handlers). Created fresh per call — never cached — because cookies differ per
 * request.
 */
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const url = getSupabaseUrl();
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_PROJECT_ID and SUPABASE_PUBLISHABLE_KEY in .env"
    );
  }

  // Imported lazily so `next/headers` never enters the STATIC module graph.
  // Several data modules that import this file also export constants/types used
  // by client components; a top-level `next/headers` import would poison those
  // client bundles. getSupabaseServer is only ever CALLED on the server.
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` is called from a Server Component where cookies are
          // read-only. Safe to ignore — Proxy refreshes the session cookie.
        }
      },
    },
  });
}

/**
 * Server-only Supabase client using the **secret** (service-role) key.
 *
 * The secret key **bypasses Row Level Security**, so it must ONLY be used for
 * privileged operations that legitimately need to: account creation on sign-up,
 * org provisioning, referral-code lookup, and validating/accepting member
 * invites. Never use it for normal user data access — use `getSupabaseServer()`
 * so RLS enforces ownership.
 */
let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = getSupabaseUrl();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_PROJECT_ID and SUPABASE_SECRET_KEY in .env"
    );
  }
  cachedAdmin ??= createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}
