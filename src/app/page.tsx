import { redirect } from "next/navigation";
import { HomeChat } from "@/components/home/home-chat";
import { getProfile } from "@/lib/settings/profile";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/auth/permissions";
import { displayFirstName } from "@/lib/user";
import type { PermissionKey } from "@/lib/settings/org";

// The home page IS the Archon chat overview, so it's useless without `use_ai`.
// Such users are sent to the first feature they can reach — Wells first (the
// product default), with the rest as fallbacks so a user who also lacks Wells
// never bounces between "/" and a page that redirects back here. Settings is
// the final fallback (it needs no permission), guaranteeing no redirect loop.
const LANDING_FALLBACKS: Array<{ path: string; perm: PermissionKey[] }> = [
  {
    path: "/wells",
    perm: [
      "add_wells",
      "view_well_production",
      "manage_well_production",
      "manage_well_equipment",
      "view_well_files",
      "manage_well_files",
    ],
  },
  { path: "/tasks", perm: ["manage_tasks"] },
  { path: "/files", perm: ["manage_files"] },
  { path: "/accounting", perm: ["view_accounting", "manage_accounting"] },
  { path: "/people", perm: ["view_royalty_owners", "manage_royalty_owners"] },
  { path: "/inventory", perm: ["manage_inventory"] },
  {
    path: "/calendar",
    perm: ["manage_personal_calendar", "manage_org_calendar"],
  },
  { path: "/analytics", perm: ["view_analytics"] },
  { path: "/pricing", perm: ["view_pricing"] },
];

export default async function HomePage() {
  const { permissions } = await getCurrentPermissions();
  const held = new Set(permissions);
  if (!held.has("use_ai")) {
    const dest = LANDING_FALLBACKS.find((c) => c.perm.some((p) => held.has(p)));
    redirect(dest?.path ?? "/settings");
  }

  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);
  const firstName = displayFirstName(profile.name, user?.email);
  return <HomeChat firstName={firstName} />;
}
