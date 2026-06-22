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
 * Master billing switch. When false (the default), the AI-credit gate, usage
 * metering, and the subscription well cap are ALL bypassed — users can do
 * anything without paying. Set `PAID_MODE=true` to turn on paid enforcement.
 */
export function isPaidMode(): boolean {
  return process.env.PAID_MODE === "true";
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

/**
 * Whether Stripe billing is configured. When false, checkout/portal/top-up and
 * the webhook are disabled, and the AI-credit gate fails open (so the app keeps
 * working in dev before billing is wired). See src/lib/billing.
 */
export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The Stripe publishable key, exposed to the browser so Stripe Elements can load
 * (`NEXT_PUBLIC_` prefix is required for client access). Returns null when unset.
 */
export function getStripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;
}

/** Whether the browser-side Stripe SDK (Elements) can be initialized. */
export function hasStripeClient(): boolean {
  return Boolean(getStripePublishableKey());
}

/** The public base URL used for Stripe redirect (success/cancel/return) URLs. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  );
}
