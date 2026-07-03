import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for the **webapp's** Supabase project, used ONLY by the
 * support feature. Support chat lives in the webapp's database; the platform
 * (this app) reaches it with the service-role key so staff can see and reply to
 * every thread. This is a DIFFERENT project from this app's own backend, so its
 * credentials live in their own env vars and never touch this app's `SUPABASE_*`
 * config:
 *
 *   WEBAPP_SUPABASE_URL         - https://<ref>.supabase.co
 *   WEBAPP_SUPABASE_SECRET_KEY  - service-role key (server-only, never shipped
 *                                  to the browser)
 *
 * Returns null when unconfigured so callers can degrade to an empty inbox
 * instead of throwing.
 */
let cached: SupabaseClient | null = null;

export function getWebappDb(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.WEBAPP_SUPABASE_URL;
  const key = process.env.WEBAPP_SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
