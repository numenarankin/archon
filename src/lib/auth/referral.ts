/**
 * Per-org referral codes.
 *
 * Each organization gets its own shareable code, generated server-side when the
 * admin account is created. The code is a 6-digit hexadecimal string. Codes are
 * unique: we check for a collision before use and the `organizations.referral_code`
 * unique constraint is the final backstop if two sign-ups race.
 *
 * Server-only: every function here uses the secret (service-role) client, which
 * is necessary at sign-up time because the new org row doesn't exist yet and the
 * request has no authenticated session to satisfy RLS.
 */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 5;

/** A fresh 6-hex referral code (lowercase storage; display uppercase in UI). */
export function generateReferralCode(): string {
  return randomBytes(3).toString("hex");
}

/**
 * A referral code not currently held by any org. Retries on the (astronomically
 * unlikely) collision; throws after a few attempts rather than loop forever.
 */
export async function uniqueReferralCode(
  admin: SupabaseClient
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (error) throw new Error(`uniqueReferralCode: ${error.message}`);
    if (!data) return code;
  }
  throw new Error("uniqueReferralCode: could not find a free code");
}

/**
 * Resolve a referral code submitted at admin sign-up to the org that owns it.
 * Returns null for an empty or unknown code — an invalid referral must never
 * fail the sign-up, it just means no referral is recorded.
 */
export async function resolveReferral(
  admin: SupabaseClient,
  code: string | null | undefined
): Promise<{ orgId: string } | null> {
  const normalized = code?.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();
  if (error) {
    // Fail soft: a lookup error drops the referral, never blocks sign-up.
    console.error("resolveReferral lookup failed", error);
    return null;
  }
  return data ? { orgId: (data as { id: string }).id } : null;
}
