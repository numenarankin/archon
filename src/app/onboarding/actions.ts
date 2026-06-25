"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/supabase/server";

export interface OnboardingInput {
  companyName: string;
  companyAddress: string;
  employeeCount: number;
  wellCount: number;
}

export interface OnboardingResult {
  wellCount: number;
}

/**
 * Step 1 of owner onboarding: persist company details + counts on the owner's
 * workspace. Does NOT mark onboarding complete — `finalizeOnboarding` stamps
 * that, and the proxy keeps owners on /onboarding until then.
 *
 * Writes go through the request-scoped client; the workspace admin-only RLS
 * write policy enforces that only an owner/admin can do this, and the
 * `owner_uid` filter targets the caller's own workspace.
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

  const sb = await getSupabaseServer();

  const { error } = await sb
    .from("workspaces")
    .update({
      name: companyName,
      company_address: companyAddress,
      employee_count: employeeCount,
      well_count: wellCount,
    })
    .eq("owner_uid", user.id);
  if (error) throw new Error(`saveOnboardingDetails: ${error.message}`);

  revalidatePath("/", "layout");

  return { wellCount };
}

/**
 * Final step of owner onboarding: stamp `onboarding_completed_at`, which lifts
 * the proxy's onboarding gate and lets the owner into the app. Idempotent: the
 * `is null` filter makes a repeat call a no-op.
 */
export async function finalizeOnboarding(): Promise<{ ok: true }> {
  const user = await requireUser();
  const sb = await getSupabaseServer();

  const { error } = await sb
    .from("workspaces")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("owner_uid", user.id)
    .is("onboarding_completed_at", null);
  if (error) throw new Error(`finalizeOnboarding: ${error.message}`);

  revalidatePath("/", "layout");

  return { ok: true };
}
