/**
 * Server-side feature flags derived from environment variables.
 *
 * `MOCK_MODE` is intentionally NOT prefixed with `NEXT_PUBLIC_`, so it is only
 * readable in server components, route handlers, and server actions.
 */
export function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

/**
 * The Supabase project URL. Derived from `SUPABASE_PROJECT_ID`
 * (`https://<id>.supabase.co`), or taken verbatim from `SUPABASE_URL` if set
 * (e.g. a custom domain). Returns null when unconfigured.
 */
export function getSupabaseUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  const projectId = process.env.SUPABASE_PROJECT_ID;
  return projectId ? `https://${projectId}.supabase.co` : null;
}

/**
 * Whether a Supabase backend is configured. When false, the data layer falls
 * back to mock data (see `isMockMode`). Lets us wire real queries incrementally
 * without breaking the prototype before the project exists.
 */
export function hasSupabase(): boolean {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SECRET_KEY);
}

/**
 * Whether ElevenLabs text-to-speech is configured. When false, the read-aloud
 * controls stay hidden and `/api/voice` returns 503.
 */
export function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVEN_LABS_KEY);
}

/** The public base URL, used to build member-invite links (see invite-email). */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  );
}
