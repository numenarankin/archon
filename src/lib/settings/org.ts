/**
 * The organization permission catalog and member types. This module is PURE
 * (no server-only imports) so it is safe to import from client components that
 * render the permissions UI. Server-side data access lives in `./org-data`.
 *
 * The model is PAGE-CENTRIC: each grantable key (other than the two admin keys)
 * turns a single page on or off for a member. The same key drives three things
 * in lockstep — the sidebar nav item, the page route guard, and (for sensitive
 * data) the RLS capability check — so toggling it in Settings genuinely enables
 * or disables that page for a member.
 */

/**
 * Every grantable capability key, in catalog order. Keys are PERSISTED in
 * `workspace_members.permissions` and referenced by the database RLS policies
 * (via `app_has_capability`), so they must stay stable. Labels/descriptions
 * (below) are UI-only and free to reword.
 */
export const PERMISSION_KEYS = [
  // Admin capabilities (not pages).
  "admin",
  "manage_members",
  // One key per page.
  "use_ai", // Home + Archon + the AI API routes
  "view_files",
  "view_email",
  "view_tasks",
  "view_calendar",
  "view_projects",
  "view_prospects", // Numena Prospecting (+ enriched contacts data)
  "view_pipeline", // Numena + Wildcat deal pipeline
  "view_kpis",
  "view_finance",
  "view_sales", // Wildcat cold-calling desk
  "view_map",
  "view_people",
  "view_accounting",
  "view_analytics",
  "view_budgeting",
  "view_pricing", // posted-price ticker
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A named cluster of permissions, used to lay out the editor modal. */
export type PermissionGroup = "General" | "Administration" | "Pages";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  /**
   * Permissions this one automatically grants. `admin` implies everything and is
   * handled separately (see {@link expandPermissions}). Page keys are flat, so
   * this is unused for them but kept for forward compatibility.
   */
  implies?: PermissionKey[];
}

/**
 * The catalog of grantable capabilities. `admin` is the master switch; every
 * other entry (under "Pages") is one page a member can be allowed into.
 */
export const PERMISSION_DEFS: readonly PermissionDef[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Full access. Every page and capability, granted automatically.",
    group: "General",
  },
  {
    key: "manage_members",
    label: "Manage members",
    description: "Invite, remove, and set page access for members.",
    group: "Administration",
  },
  // ── Pages ──────────────────────────────────────────────────────────────────
  {
    key: "use_ai",
    label: "AI assistant",
    description: "Home and the Archon assistant (and AI voice/chat).",
    group: "Pages",
  },
  {
    key: "view_files",
    label: "Files",
    description: "The files and knowledge-base browser.",
    group: "Pages",
  },
  {
    key: "view_email",
    label: "Email",
    description: "The connected mailbox.",
    group: "Pages",
  },
  {
    key: "view_tasks",
    label: "Tasks",
    description: "The kanban task board.",
    group: "Pages",
  },
  {
    key: "view_calendar",
    label: "Calendar",
    description: "The calendar.",
    group: "Pages",
  },
  {
    key: "view_projects",
    label: "Projects",
    description: "Projects and their folders.",
    group: "Pages",
  },
  {
    key: "view_prospects",
    label: "Prospecting",
    description: "The prospecting workspace and enriched contact lists (PII).",
    group: "Pages",
  },
  {
    key: "view_pipeline",
    label: "Pipeline",
    description: "The deal pipeline board.",
    group: "Pages",
  },
  {
    key: "view_kpis",
    label: "KPIs",
    description: "The platform KPI dashboard.",
    group: "Pages",
  },
  {
    key: "view_finance",
    label: "Finance",
    description: "Company bank/finance dashboard.",
    group: "Pages",
  },
  {
    key: "view_sales",
    label: "Sales desk",
    description: "The cold-calling desk, prospects, and call history.",
    group: "Pages",
  },
  {
    key: "view_map",
    label: "Map",
    description: "The wells map.",
    group: "Pages",
  },
  {
    key: "view_people",
    label: "People",
    description: "Royalty owners and contacts.",
    group: "Pages",
  },
  {
    key: "view_accounting",
    label: "Accounting",
    description: "The accounting ledger.",
    group: "Pages",
  },
  {
    key: "view_analytics",
    label: "Analytics",
    description: "Analytics dashboards.",
    group: "Pages",
  },
  {
    key: "view_budgeting",
    label: "Budgeting",
    description: "Personal budgeting.",
    group: "Pages",
  },
  {
    key: "view_pricing",
    label: "Pricing",
    description: "Posted prices and the price ticker.",
    group: "Pages",
  },
];

const DEF_BY_KEY: Record<PermissionKey, PermissionDef> = Object.fromEntries(
  PERMISSION_DEFS.map((d) => [d.key, d])
) as Record<PermissionKey, PermissionDef>;

/** Lookup helper for UI code that wants a permission's label/description/group. */
export function permissionDef(key: PermissionKey): PermissionDef {
  return DEF_BY_KEY[key];
}

/** Permission group order for the editor modal ("General"/admin is special). */
export const PERMISSION_GROUP_ORDER: PermissionGroup[] = [
  "Administration",
  "Pages",
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
 * everything, and each granted permission pulls in the ones it implies. Returns
 * catalog order.
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
 * permissions modal. Every page is off by default. */
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
