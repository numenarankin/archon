import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for the **prospecting** Supabase project (numena-data).
 *
 * This is a DIFFERENT Supabase project from this app's own backend. We read
 * from it directly (Form D filings) rather than copying the data over. Its
 * credentials live in their own env vars so this app's `SUPABASE_*` config is
 * untouched:
 *
 *   PROSPECTING_SUPABASE_URL          - https://<ref>.supabase.co
 *   PROSPECTING_SUPABASE_SECRET_KEY   - sb_secret_... (service role, never sent
 *                                        to the browser — server use only)
 *
 * Returns null when unconfigured so callers can fall back to an empty list
 * instead of throwing.
 */
let cached: SupabaseClient | null = null;

export function getProspectingClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.PROSPECTING_SUPABASE_URL;
  const key = process.env.PROSPECTING_SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
