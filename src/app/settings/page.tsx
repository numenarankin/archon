import { getProfile } from "@/lib/settings/profile";
import { getOrgMembers } from "@/lib/settings/org-data";
import { getOrgInfo, ensureReferralCode } from "@/lib/settings/org-info";
import { getGoogleWorkspaceSettingsView } from "@/lib/settings/integrations";
import { getAppUrl } from "@/lib/env";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ section }, profile, members, org, referralCode, googleSettings] =
    await Promise.all([
      searchParams,
      getProfile(),
      getOrgMembers(),
      getOrgInfo(),
      ensureReferralCode(),
      getGoogleWorkspaceSettingsView(),
    ]);

  return (
    <SettingsWorkspace
      profile={profile}
      members={members}
      referralCode={referralCode ?? org?.referralCode ?? null}
      companyAddress={org?.companyAddress ?? null}
      googleSettings={googleSettings}
      initialSection={section}
      appUrl={getAppUrl()}
    />
  );
}
