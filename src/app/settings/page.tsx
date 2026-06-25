import { getProfile } from "@/lib/settings/profile";
import { getOrgMembers } from "@/lib/settings/org-data";
import { getOrgInfo, ensureReferralCode } from "@/lib/settings/org-info";
import { getGoogleWorkspaceSettingsView } from "@/lib/settings/integrations";
import { getCustomSkills } from "@/lib/archon/skills-store";
import { getAllContextDocs } from "@/lib/ai/context/docs";
import { getAppUrl } from "@/lib/env";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [
    { section },
    profile,
    members,
    org,
    referralCode,
    googleSettings,
    customSkills,
    contextDocs,
  ] = await Promise.all([
    searchParams,
    getProfile(),
    getOrgMembers(),
    getOrgInfo(),
    ensureReferralCode(),
    getGoogleWorkspaceSettingsView(),
    getCustomSkills(),
    getAllContextDocs(),
  ]);

  return (
    <SettingsWorkspace
      profile={profile}
      members={members}
      referralCode={referralCode ?? org?.referralCode ?? null}
      companyAddress={org?.companyAddress ?? null}
      googleSettings={googleSettings}
      customSkills={customSkills}
      contextDocs={contextDocs}
      initialSection={section}
      appUrl={getAppUrl()}
    />
  );
}
