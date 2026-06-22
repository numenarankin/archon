import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Browser-side Stripe.js loader for embedded Elements. Memoized so the script is
 * fetched once per page. Reads the publishable key inlined at build time via the
 * `NEXT_PUBLIC_` prefix; returns a promise of `null` when billing isn't configured
 * so callers can render a graceful "not connected" state instead of crashing.
 */
let cached: Promise<Stripe | null> | null = null;

export function getStripeBrowser(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  cached ??= loadStripe(key);
  return cached;
}
