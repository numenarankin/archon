import { redirect } from "next/navigation";
import { HomeChat } from "@/components/home/home-chat";
import { getProfile } from "@/lib/settings/profile";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/auth/permissions";
import { displayFirstName } from "@/lib/user";
import type { PermissionKey } from "@/lib/settings/org";

// The home page IS the Archon chat overview, so it's useless without `use_ai`.
// Such users are sent to the first page they can reach (catalog order), with
// Settings as the final fallback (it needs no permission) so there's never a
// redirect loop between "/" and a page that bounces back here.
const LANDING_FALLBACKS: Array<{ path: string; perm: PermissionKey }> = [
  { path: "/files", perm: "view_files" },
  { path: "/tasks", perm: "view_tasks" },
  { path: "/projects", perm: "view_projects" },
  { path: "/map", perm: "view_map" },
  { path: "/people", perm: "view_people" },
  { path: "/accounting", perm: "view_accounting" },
  { path: "/analytics", perm: "view_analytics" },
  { path: "/calendar", perm: "view_calendar" },
  { path: "/email", perm: "view_email" },
  { path: "/numena/prospecting", perm: "view_prospects" },
  { path: "/wildcat/sales", perm: "view_sales" },
  { path: "/budgeting", perm: "view_budgeting" },
];

export default async function HomePage() {
  const { permissions } = await getCurrentPermissions();
  const held = new Set(permissions);
  if (!held.has("use_ai")) {
    const dest = LANDING_FALLBACKS.find((c) => held.has(c.perm));
    redirect(dest?.path ?? "/settings");
  }

  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);
  const firstName = displayFirstName(profile.name, user?.email);
  return <HomeChat firstName={firstName} />;
}
