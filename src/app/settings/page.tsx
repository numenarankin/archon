import { getProfile } from "@/lib/settings/profile";
import { getOrgMembers } from "@/lib/settings/org-data";
import { getOrgInfo, ensureReferralCode } from "@/lib/settings/org-info";
import { getAppUrl } from "@/lib/env";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ section }, profile, members, org, referralCode] = await Promise.all([
    searchParams,
    getProfile(),
    getOrgMembers(),
    getOrgInfo(),
    ensureReferralCode(),
  ]);

  return (
    <SettingsWorkspace
      profile={profile}
      members={members}
      referralCode={referralCode ?? org?.referralCode ?? null}
      companyAddress={org?.companyAddress ?? null}
      initialSection={section}
      appUrl={getAppUrl()}
    />
  );
}
