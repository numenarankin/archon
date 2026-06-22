/**
 * Subscription tier catalog + credit economics.
 *
 * Pure module (no server imports) so both the onboarding UI and server actions
 * can use it. It maps a well count to a recommended tier (onboarding) and is
 * the single source of truth for each tier's well cap, monthly AI-credit
 * allotment, and Stripe Price env var (billing). Secrets/price IDs are read
 * from env on the server (see `tierPriceEnvKey`), never inlined here.
 *
 * Boundaries come from docs/billing.md. Tier 5 (200+ wells) is contact-sales,
 * not a self-serve price — callers should render it as "talk to sales" rather
 * than a checkout amount.
 *
 * CREDITS — the internal unit metered for every AI call. One credit = one cent
 * (`DOLLARS_PER_CREDIT`); a call is billed at provider cost × `CREDIT_MARKUP`,
 * expressed in those 1-cent credits. Tune those two constants (and the
 * per-provider rates) to set real pricing — the architecture doesn't depend on
 * the exact numbers. Today 1 credit = $0.01 → 100 credits per $1 of usage. Each
 * tier's `monthlyCredits` increases with the plan and resets every period.
 */

export type TierKey = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5";

export interface Tier {
  key: TierKey;
  /** Inclusive lower bound of the well-count band. */
  minWells: number;
  /** Inclusive upper bound, or null for the open-ended top band. */
  maxWells: number | null;
  /** Monthly price in USD, or null for contact-sales. */
  monthlyUsd: number | null;
  label: string;
  /** Max wells the org may have on platform. Enforced in src/lib/wells. */
  wellCap: number;
  /** Free AI credits granted at the start of each billing period (no rollover). */
  monthlyCredits: number;
  /** Env var holding this tier's Stripe Price ID (null for contact-sales). */
  priceEnvKey: string | null;
}

/** Practical "no cap" for the open-ended top band. */
export const UNLIMITED_WELLS = 1_000_000;

export const TIERS: readonly Tier[] = [
  { key: "tier_1", minWells: 1, maxWells: 49, monthlyUsd: 500, label: "Tier 1", wellCap: 49, monthlyCredits: 10_000, priceEnvKey: "STRIPE_PRICE_TIER_1" },
  { key: "tier_2", minWells: 50, maxWells: 99, monthlyUsd: 1000, label: "Tier 2", wellCap: 99, monthlyCredits: 25_000, priceEnvKey: "STRIPE_PRICE_TIER_2" },
  { key: "tier_3", minWells: 100, maxWells: 149, monthlyUsd: 1500, label: "Tier 3", wellCap: 149, monthlyCredits: 50_000, priceEnvKey: "STRIPE_PRICE_TIER_3" },
  { key: "tier_4", minWells: 150, maxWells: 199, monthlyUsd: 2000, label: "Tier 4", wellCap: 199, monthlyCredits: 100_000, priceEnvKey: "STRIPE_PRICE_TIER_4" },
  { key: "tier_5", minWells: 200, maxWells: null, monthlyUsd: null, label: "Tier 5", wellCap: UNLIMITED_WELLS, monthlyCredits: 250_000, priceEnvKey: null },
] as const;

/** True when this tier is contact-sales rather than a self-serve price. */
export function isContactSales(tier: Tier): boolean {
  return tier.monthlyUsd === null;
}

export function isTierKey(value: string | null | undefined): value is TierKey {
  return (
    value === "tier_1" || value === "tier_2" || value === "tier_3" ||
    value === "tier_4" || value === "tier_5"
  );
}

/** Look up a tier by key, falling back to the entry tier for unknown keys. */
export function tierByKey(key: string | null | undefined): Tier {
  return TIERS.find((t) => t.key === key) ?? TIERS[0];
}

/** The env var name holding this tier's Stripe Price ID, or null. */
export function tierPriceEnvKey(key: TierKey): string | null {
  return tierByKey(key).priceEnvKey;
}

/**
 * Recommend a tier from a well count. Counts below the first band fall back to
 * tier 1 (the entry plan); the open-ended top band catches everything at 200+.
 */
export function recommendTier(wellCount: number): Tier {
  const wells = Number.isFinite(wellCount) ? Math.max(0, Math.floor(wellCount)) : 0;
  const match = TIERS.find(
    (t) => wells >= t.minWells && (t.maxWells === null || wells <= t.maxWells)
  );
  return match ?? TIERS[0];
}

// --- Credit economics -------------------------------------------------------

/** USD a single credit represents — one cent. */
export const DOLLARS_PER_CREDIT = 0.01;
/** Multiplier applied to raw cost so credits bill above cost (margin). */
export const CREDIT_MARKUP = 1.5;

/**
 * Anthropic Opus 4.8 pricing, USD per token (from the model catalog:
 * $5 / 1M input, $25 / 1M output). Keep in sync if the model/pricing changes.
 */
const ANTHROPIC_INPUT_USD_PER_TOKEN = 5 / 1_000_000;
const ANTHROPIC_OUTPUT_USD_PER_TOKEN = 25 / 1_000_000;

/**
 * ElevenLabs cost estimates. Flash v2.5 TTS is metered per character; Scribe
 * STT per call here (a coarse flat estimate — refine with real audio duration
 * if it matters). Deliberately conservative.
 */
const ELEVENLABS_TTS_USD_PER_CHAR = 0.00003; // ~$30 / 1M chars
const ELEVENLABS_STT_USD_PER_CALL = 0.01;

/** Anthropic web search: $10 per 1,000 search requests. */
const ANTHROPIC_WEB_SEARCH_USD_PER_REQUEST = 10 / 1_000;

/** Convert a USD provider cost to credits. Always ≥ 1 so no call is free. */
function usdToCredits(usd: number): number {
  return Math.max(1, Math.ceil((usd * CREDIT_MARKUP) / DOLLARS_PER_CREDIT));
}

export function anthropicCredits(inputTokens: number, outputTokens: number): number {
  const usd =
    inputTokens * ANTHROPIC_INPUT_USD_PER_TOKEN +
    outputTokens * ANTHROPIC_OUTPUT_USD_PER_TOKEN;
  return usdToCredits(usd);
}

export function elevenLabsTtsCredits(chars: number): number {
  return usdToCredits(chars * ELEVENLABS_TTS_USD_PER_CHAR);
}

export function elevenLabsSttCredits(): number {
  return usdToCredits(ELEVENLABS_STT_USD_PER_CALL);
}

/** Credits for `requests` Anthropic web searches (0 → 0, never the ≥1 floor). */
export function anthropicWebSearchCredits(requests: number): number {
  if (requests <= 0) return 0;
  return usdToCredits(requests * ANTHROPIC_WEB_SEARCH_USD_PER_REQUEST);
}

/** USD a top-up purchase grants as credits (inverse of DOLLARS_PER_CREDIT). */
export function dollarsToTopUpCredits(usd: number): number {
  return Math.round(usd / DOLLARS_PER_CREDIT);
}
