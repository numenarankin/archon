import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrgInfo } from "@/lib/settings/org-info";
import { getCurrentPermissions } from "@/lib/auth/permissions";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * Owner onboarding. Owners land here right after sign-up to provide company
 * details, then optionally invite their team before entering the workspace.
 *
 * Access is gated by the proxy, which sends owners with incomplete onboarding
 * here; this page only bounces non-owners (members have no workspace to set up).
 * We deliberately do NOT redirect completed owners away: doing so would bounce
 * the optional invite hand-off the moment its server actions refresh this route.
 */
export default async function OnboardingPage() {
  await requireUser();
  const [org, { isOwner }] = await Promise.all([
    getOrgInfo(),
    getCurrentPermissions(),
  ]);

  if (!org || !isOwner) redirect("/");

  return (
    <OnboardingFlow
      companyName={org.name}
      companyAddress={org.companyAddress}
      employeeCount={org.employeeCount}
      wellCount={org.wellCount}
      alreadyOnboarded={org.onboardingCompleted}
    />
  );
}
