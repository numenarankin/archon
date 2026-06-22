"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/permissions-context";
import { ProfileSection } from "@/components/settings/profile-section";
import { OrganizationSection } from "@/components/settings/organization-section";
import type { Profile } from "@/lib/settings/profile";
import type { OrgMember } from "@/lib/settings/org";

type Section = "profile" | "organization";

const NAV: ReadonlyArray<{ id: Section; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "organization", label: "Organization" },
];

function isSection(value: string | undefined): value is Section {
  return value === "profile" || value === "organization";
}

export function SettingsWorkspace({
  profile,
  members,
  referralCode,
  companyAddress,
  initialSection,
  appUrl,
}: {
  profile: Profile;
  members: OrgMember[];
  referralCode: string | null;
  companyAddress: string | null;
  /** Tab to open initially (e.g. from a ?section= link). */
  initialSection?: string;
  /** Public base URL (server-resolved) for the referral link. */
  appUrl: string;
}) {
  // Org settings (every tab but Profile) are admin-only; non-admins see only
  // their own profile. This mirrors the server-side requireAdmin guards on the
  // settings actions — the UI hiding is convenience, not the security boundary.
  const isAdmin = useCan("admin");
  const nav = isAdmin ? NAV : NAV.filter((item) => item.id === "profile");
  const requested = isSection(initialSection) ? initialSection : "profile";
  const [section, setSection] = useState<Section>(
    isAdmin || requested === "profile" ? requested : "profile"
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-10">
      {/* Top tabs, header-styled like /people. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1">
        {nav.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={section === id}
            onClick={() => setSection(id)}
            className={cn(
              "font-heading text-2xl font-semibold tracking-tight transition-colors",
              section === id
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* px/pt give card borders, shadows, and focus rings room so the scroll
          container (overflow-y also clips x) doesn't shear their edges. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-2">
        {section === "profile" && (
          <ProfileSection
            profile={profile}
            referralCode={referralCode}
            appUrl={appUrl}
          />
        )}
        {isAdmin && section === "organization" && (
          <OrganizationSection
            profile={profile}
            members={members}
            companyAddress={companyAddress}
          />
        )}
      </div>
    </div>
  );
}
