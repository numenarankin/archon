import { getProfile } from "@/lib/settings/profile";
import { getOrgMembers } from "@/lib/settings/org-data";
import { getOrgInfo } from "@/lib/settings/org-info";
import { getGoogleWorkspaceSettingsView } from "@/lib/settings/integrations";
import { getCustomSkills } from "@/lib/archon/skills-store";
import { getAllContextDocs } from "@/lib/ai/context/docs";
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
    googleSettings,
    customSkills,
    contextDocs,
  ] = await Promise.all([
    searchParams,
    getProfile(),
    getOrgMembers(),
    getOrgInfo(),
    getGoogleWorkspaceSettingsView(),
    getCustomSkills(),
    getAllContextDocs(),
  ]);

  return (
    <SettingsWorkspace
      profile={profile}
      members={members}
      companyAddress={org?.companyAddress ?? null}
      googleSettings={googleSettings}
      customSkills={customSkills}
      contextDocs={contextDocs}
      initialSection={section}
    />
  );
}
