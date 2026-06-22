import "server-only";

import { getGoogleWorkspaceSettings } from "@/lib/settings/integrations";

/**
 * Shared Google Workspace OAuth, used by both the Gmail client
 * (`@/lib/email/gmail`) and the Google Calendar client
 * (`@/lib/calendar/google-calendar`).
 *
 * Credentials are resolved DB-first (managed in Settings, stored in
 * `integration_settings`) and fall back to the matching environment variables.
 * That lets the app run from `.env` OR be configured entirely from the UI. The
 * same OAuth client covers Gmail and Calendar; setup steps are in
 * `docs/gmail.md`.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Mailbox address; used as the Gmail "From" and the API userId. */
  userEmail: string;
}

/**
 * Resolve the active Google credentials, preferring values saved in Settings
 * and falling back to environment variables per field. Returns null unless the
 * three required fields (client id, secret, refresh token) are all present.
 */
export async function getGoogleCredentials(): Promise<GoogleCredentials | null> {
  const db = await getGoogleWorkspaceSettings();

  const clientId = db.clientId || process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = db.clientSecret || process.env.GOOGLE_CLIENT_SECRET || "";
  const refreshToken = db.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || "";
  const userEmail = db.userEmail || process.env.GOOGLE_USER_EMAIL || "";

  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, userEmail };
}

/** Whether Google Workspace credentials are configured (DB or env). */
export async function hasGoogleAuth(): Promise<boolean> {
  return (await getGoogleCredentials()) !== null;
}

/**
 * Exchange the long-lived refresh token for a short-lived access token. Pass
 * already-resolved credentials to avoid a second lookup; otherwise they are
 * resolved here.
 */
export async function getGoogleAccessToken(
  creds?: GoogleCredentials
): Promise<string> {
  const c = creds ?? (await getGoogleCredentials());
  if (!c) throw new Error("Google Workspace is not configured.");

  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google token refresh returned no access_token");
  }
  return data.access_token;
}
