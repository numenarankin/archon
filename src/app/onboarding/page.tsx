import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrgInfo } from "@/lib/settings/org-info";
import { getCurrentPermissions } from "@/lib/auth/permissions";
import { listTiers } from "@/lib/billing/actions";
import { getSubscription } from "@/lib/billing/subscription";
import { hasStripe } from "@/lib/env";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * Admin onboarding. Owners land here right after sign-up to provide company
 * details, then select a plan + add a card. The backend is finalized right after
 * payment, so the closing "invite your team" step is wholly optional and never
 * blocks what came before it.
 *
 * Access is gated by the proxy, which sends owners with incomplete onboarding
 * here; this page only bounces non-owners (members have no org to set up). We
 * deliberately do NOT redirect completed owners away: doing so would bounce the
 * optional invite hand-off the moment its server actions refresh this route. The
 * flow resumes on the right step instead.
 */
export default async function OnboardingPage() {
  await requireUser();
  const [org, tiers, subscription, { isOwner }] = await Promise.all([
    getOrgInfo(),
    listTiers(),
    getSubscription(),
    getCurrentPermissions(),
  ]);

  if (!org || !isOwner) redirect("/");

  return (
    <OnboardingFlow
      companyName={org.name}
      companyAddress={org.companyAddress}
      employeeCount={org.employeeCount}
      wellCount={org.wellCount}
      recommendedTier={org.recommendedTier}
      tiers={tiers}
      stripeConfigured={hasStripe()}
      hasSubscription={subscription !== null}
      alreadyOnboarded={org.onboardingCompleted}
    />
  );
}
