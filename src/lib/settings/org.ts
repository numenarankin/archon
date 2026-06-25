/**
 * The organization permission catalog and member types. This module is PURE
 * (no server-only imports) so it is safe to import from client components that
 * render the permissions UI. Server-side data access lives in `./org-data`.
 */

/**
 * Every grantable capability key, in catalog order. Keys are PERSISTED in
 * `org_members.permissions` and referenced by the database RLS policies, so they
 * must stay stable. Labels/descriptions (below) are UI-only and free to reword.
 */
export const PERMISSION_KEYS = [
  "admin",
  "manage_members",
  "manage_files",
  "add_wells",
  "view_well_production",
  "manage_well_production",
  "manage_well_equipment",
  "view_well_files",
  "manage_well_files",
  "view_royalty_owners",
  "manage_royalty_owners",
  "manage_projects",
  "manage_inventory",
  "use_ai",
  "buy_ai_credits",
  "manage_tasks",
  "manage_personal_calendar",
  "manage_org_calendar",
  "view_accounting",
  "manage_accounting",
  "view_analytics",
  "view_pricing",
  "view_prospects",
  "manage_skills",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A named cluster of related permissions, used to lay out the editor modal. */
export type PermissionGroup =
  | "General"
  | "Members"
  | "Files"
  | "Wells"
  | "People"
  | "Projects"
  | "Inventory"
  | "AI"
  | "Tasks"
  | "Calendar"
  | "Accounting"
  | "Analytics"
  | "Pricing"
  | "Prospecting"
  | "Skills";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  /**
   * Permissions this one automatically grants. Granting a `manage_*` capability
   * implies its `view_*` counterpart; the editor reflects this by checking and
   * locking the implied switch. `admin` implies everything and is handled
   * separately (see {@link expandPermissions}).
   */
  implies?: PermissionKey[];
}

/**
 * The catalog of grantable capabilities. Each is a piece of functionality the
 * org can switch on or off per member via the permissions modal.
 */
export const PERMISSION_DEFS: readonly PermissionDef[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Full access. Every permission below, granted automatically.",
    group: "General",
  },
  {
    key: "manage_members",
    label: "Manage members",
    description: "Invite, remove, and set permissions for members.",
    group: "Members",
  },
  {
    key: "manage_files",
    label: "Manage files",
    description: "Upload, edit, and delete files and documents.",
    group: "Files",
  },
  {
    key: "add_wells",
    label: "Add wells",
    description: "Create and edit wells.",
    group: "Wells",
  },
  {
    key: "view_well_production",
    label: "View well production",
    description: "View production readings and well figures.",
    group: "Wells",
  },
  {
    key: "manage_well_production",
    label: "Manage well production",
    description: "Record and edit production readings.",
    group: "Wells",
    implies: ["view_well_production"],
  },
  {
    key: "manage_well_equipment",
    label: "Manage well equipment",
    description: "Add and edit equipment on a well.",
    group: "Wells",
  },
  {
    key: "view_well_files",
    label: "View well files",
    description: "Open files attached to a well.",
    group: "Wells",
  },
  {
    key: "manage_well_files",
    label: "Manage well files",
    description: "Attach and remove files on a well.",
    group: "Wells",
    implies: ["view_well_files"],
  },
  {
    key: "view_royalty_owners",
    label: "View royalty owners",
    description: "View royalty owners and their interests.",
    group: "People",
  },
  {
    key: "manage_royalty_owners",
    label: "Manage royalty owners",
    description: "Add and edit royalty owners, contractors, and providers.",
    group: "People",
    implies: ["view_royalty_owners"],
  },
  {
    key: "manage_projects",
    label: "Manage projects",
    description: "Create and edit projects.",
    group: "Projects",
  },
  {
    key: "manage_inventory",
    label: "Manage inventory",
    description: "Add and adjust inventory records.",
    group: "Inventory",
  },
  {
    key: "use_ai",
    label: "Use AI",
    description: "Chat with the Archon assistant.",
    group: "AI",
  },
  {
    key: "buy_ai_credits",
    label: "Buy AI credits",
    description: "Purchase additional AI credits for the org.",
    group: "AI",
  },
  {
    key: "manage_tasks",
    label: "Manage tasks",
    description: "Create, assign, and complete tasks.",
    group: "Tasks",
  },
  {
    key: "manage_personal_calendar",
    label: "Manage personal calendar",
    description: "Create and edit their own calendar events.",
    group: "Calendar",
  },
  {
    key: "manage_org_calendar",
    label: "Manage org calendar",
    description: "Create events for others and for the organization.",
    group: "Calendar",
  },
  {
    key: "view_accounting",
    label: "View accounting",
    description: "View accounting and financial data.",
    group: "Accounting",
  },
  {
    key: "manage_accounting",
    label: "Manage accounting",
    description: "Add, edit, and import transactions.",
    group: "Accounting",
    implies: ["view_accounting"],
  },
  {
    key: "view_analytics",
    label: "View analytics",
    description: "View analytics dashboards.",
    group: "Analytics",
  },
  {
    key: "view_pricing",
    label: "View pricing",
    description: "View posted prices and price projections.",
    group: "Pricing",
  },
  {
    key: "view_prospects",
    label: "View prospects",
    description: "View the prospecting pipeline and enriched contact lists (PII).",
    group: "Prospecting",
  },
  {
    key: "manage_skills",
    label: "Manage skills",
    description: "View and configure Archon skills.",
    group: "Skills",
  },
];

const DEF_BY_KEY: Record<PermissionKey, PermissionDef> = Object.fromEntries(
  PERMISSION_DEFS.map((d) => [d.key, d])
) as Record<PermissionKey, PermissionDef>;

/** Lookup helper for UI code that wants a permission's label/description/group. */
export function permissionDef(key: PermissionKey): PermissionDef {
  return DEF_BY_KEY[key];
}

/** Permission group order for the editor modal. */
export const PERMISSION_GROUP_ORDER: PermissionGroup[] = [
  "Members",
  "Files",
  "Wells",
  "Projects",
  "People",
  "Inventory",
  "Tasks",
  "Calendar",
  "Accounting",
  "AI",
  "Analytics",
  "Pricing",
  "Prospecting",
  "Skills",
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = [...PERMISSION_KEYS];

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

/** Type guard: is an arbitrary string a known permission key? */
export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

/** Drop unknown/legacy keys and de-duplicate, preserving catalog order. */
export function cleanPermissions(keys: readonly string[]): PermissionKey[] {
  const set = new Set(keys.filter(isPermissionKey) as PermissionKey[]);
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

/**
 * Expand a raw permission list into the full EFFECTIVE set: `admin` grants
 * everything, and each granted permission pulls in the ones it implies (e.g.
 * `manage_accounting` -> `view_accounting`). Returns catalog order.
 */
export function expandPermissions(keys: readonly PermissionKey[]): PermissionKey[] {
  const set = new Set<PermissionKey>();
  const add = (k: PermissionKey) => {
    if (set.has(k)) return;
    set.add(k);
    DEF_BY_KEY[k]?.implies?.forEach(add);
  };
  for (const k of keys) add(k);
  if (set.has("admin")) {
    return [...PERMISSION_KEYS];
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

/** Does this (raw) permission list effectively grant `target`? */
export function permissionsInclude(
  keys: readonly PermissionKey[],
  target: PermissionKey
): boolean {
  return expandPermissions(keys).includes(target);
}

/** What a freshly-invited member starts with: nothing, until granted in the
 * permissions modal. Every capability is off by default. */
export const DEFAULT_PERMISSIONS: PermissionKey[] = [];

export type MemberStatus = "active" | "invited";

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  permissions: PermissionKey[];
  status: MemberStatus;
  avatarUrl: string | null;
}
