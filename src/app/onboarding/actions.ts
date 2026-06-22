"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recommendTier } from "@/lib/billing/tiers";

export interface OnboardingInput {
  companyName: string;
  companyAddress: string;
  employeeCount: number;
  wellCount: number;
}

export interface OnboardingResult {
  recommendedTier: string;
  wellCount: number;
}

/**
 * Step 1 of admin onboarding: persist company details + counts and the tier
 * recommended from the well count. This does NOT mark onboarding complete; the
 * owner still has to select a plan and add a card. Completion is stamped later
 * by `finalizeOnboarding`, and the proxy keeps owners on /onboarding until then.
 *
 * Writes go through the request-scoped client, so the org's `is_org_owner` write
 * policy enforces that only the owner can do this. The filter on `owner_uid` is
 * belt-and-braces on top of that RLS policy.
 */
export async function saveOnboardingDetails(
  input: OnboardingInput
): Promise<OnboardingResult> {
  const user = await requireUser();

  const companyName = input.companyName.trim();
  const companyAddress = input.companyAddress.trim();
  const employeeCount = Math.max(0, Math.floor(input.employeeCount));
  const wellCount = Math.max(0, Math.floor(input.wellCount));

  if (!companyName) throw new Error("Company name is required.");
  if (!companyAddress) throw new Error("Company address is required.");
  if (!Number.isFinite(input.wellCount) || wellCount < 1) {
    throw new Error("Enter the number of wells (at least 1).");
  }

  const tier = recommendTier(wellCount);
  const sb = await getSupabaseServer();

  const { error } = await sb
    .from("organizations")
    .update({
      name: companyName,
      company_address: companyAddress,
      employee_count: employeeCount,
      well_count: wellCount,
      recommended_tier: tier.key,
    })
    .eq("owner_uid", user.id);
  if (error) throw new Error(`saveOnboardingDetails: ${error.message}`);

  revalidatePath("/", "layout");

  return { recommendedTier: tier.key, wellCount };
}

/**
 * Final step of admin onboarding: stamp `onboarding_completed_at`, which lifts
 * the proxy's onboarding gate and lets the owner into the app. Called once the
 * owner has subscribed + added a card, or, when billing isn't configured or the
 * recommended plan is contact-sales (no self-serve price), once they choose to
 * continue. Idempotent: the `is null` filter makes a repeat call a no-op.
 */
export async function finalizeOnboarding(): Promise<{ ok: true }> {
  const user = await requireUser();
  const sb = await getSupabaseServer();

  const { error } = await sb
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("owner_uid", user.id)
    .is("onboarding_completed_at", null);
  if (error) throw new Error(`finalizeOnboarding: ${error.message}`);

  revalidatePath("/", "layout");

  return { ok: true };
}
