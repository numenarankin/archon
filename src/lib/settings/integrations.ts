import "server-only";

import { hasSupabase } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Integration credentials store (Google Workspace for Gmail + Calendar).
 *
 * These secrets live in the `integration_settings` table (RLS-locked to the
 * service role) so they can be managed from Settings instead of `.env`. The
 * Google clients read them via `@/lib/google/auth`, which prefers these DB
 * values and falls back to the matching environment variables.
 *
 * Reads/writes go through the admin (service-role) client because the table has
 * no anon/authenticated RLS policies — secrets are never exposed to the data
 * API or the browser.
 */

interface IntegrationRow {
  google_client_id: string | null;
  google_client_secret: string | null;
  google_refresh_token: string | null;
  google_user_email: string | null;
}

/**
 * Read the current user's integration row (per-user secrets), tolerating an
 * unconfigured DB, no session, or a missing table. Uses the admin client because
 * the table has no anon/authenticated policies, scoped explicitly to the caller's
 * owner_id. Falls back (null) to the env vars when nothing is stored.
 */
async function readRow(): Promise<IntegrationRow | null> {
  if (!hasSupabase()) return null;
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .select(
        "google_client_id, google_client_secret, google_refresh_token, google_user_email"
      )
      .eq("owner_id", user.id)
      .maybeSingle();
    // Table not migrated yet, or any transient error: fall back to env vars.
    if (error) return null;
    return (data as IntegrationRow | null) ?? null;
  } catch {
    return null;
  }
}

export interface GoogleWorkspaceSettings {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
}

/** Full Google Workspace settings from the DB (secrets included). Server-only. */
export async function getGoogleWorkspaceSettings(): Promise<GoogleWorkspaceSettings> {
  const row = await readRow();
  return {
    clientId: row?.google_client_id?.trim() ?? "",
    clientSecret: row?.google_client_secret?.trim() ?? "",
    refreshToken: row?.google_refresh_token?.trim() ?? "",
    userEmail: row?.google_user_email?.trim() ?? "",
  };
}

/**
 * Redacted view for the Settings UI: the non-secret fields in full, plus
 * booleans for whether each secret is set. Secrets themselves are never
 * returned to the client. `envFallback` reports that credentials are present in
 * the environment even though nothing is saved in the DB.
 */
export interface GoogleWorkspaceSettingsView {
  clientId: string;
  userEmail: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  /** True when the env vars supply a complete set and the DB has none. */
  envFallback: boolean;
}

export async function getGoogleWorkspaceSettingsView(): Promise<GoogleWorkspaceSettingsView> {
  const row = await readRow();
  const dbConfigured = Boolean(
    row?.google_client_id?.trim() &&
      row?.google_client_secret?.trim() &&
      row?.google_refresh_token?.trim()
  );
  const envConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
  return {
    clientId: row?.google_client_id?.trim() ?? "",
    userEmail: row?.google_user_email?.trim() ?? "",
    hasClientSecret: Boolean(row?.google_client_secret?.trim()),
    hasRefreshToken: Boolean(row?.google_refresh_token?.trim()),
    envFallback: envConfigured && !dbConfigured,
  };
}
