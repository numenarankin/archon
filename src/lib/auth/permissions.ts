/**
 * Server-side resolver for the signed-in user's EFFECTIVE org permissions.
 *
 * This is the source of truth the UI reads to decide what to show. It mirrors
 * the database RLS rules (which remain the real enforcement boundary): the org
 * owner gets everything; a member gets their granted capabilities, expanded so
 * `admin` implies all and each `manage_*` implies its `view_*` counterpart.
 *
 * Server-only (request-scoped Supabase + `next/headers`). Client components read
 * the resolved list through the `PermissionsProvider` context instead.
 */

import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  ALL_PERMISSION_KEYS,
  cleanPermissions,
  expandPermissions,
  type PermissionKey,
} from "@/lib/settings/org";

export interface CurrentPermissions {
  isOwner: boolean;
  /** Fully expanded effective permission keys (catalog order). */
  permissions: PermissionKey[];
}

/**
 * Resolve the current user's effective permissions from their workspace
 * membership. A workspace `owner` or `admin` gets full access; a `member` gets
 * the expanded set of their granted capabilities. A signed-out user (or one with
 * no membership) gets nothing. Without Supabase configured the app runs fully
 * open (local dev).
 */
export async function getCurrentPermissions(): Promise<CurrentPermissions> {
  if (!hasSupabase()) {
    return { isOwner: true, permissions: [...ALL_PERMISSION_KEYS] };
  }

  try {
    const user = await getSessionUser();
    if (!user) return { isOwner: false, permissions: [] };

    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("workspace_members")
      .select("role, permissions")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { isOwner: false, permissions: [] };

    const row = data as { role: string; permissions: string[] | null };
    const isOwner = row.role === "owner";
    if (isOwner || row.role === "admin") {
      return { isOwner, permissions: [...ALL_PERMISSION_KEYS] };
    }
    return {
      isOwner: false,
      permissions: expandPermissions(cleanPermissions(row.permissions ?? [])),
    };
  } catch (error) {
    console.error("getCurrentPermissions failed", error);
    return { isOwner: false, permissions: [] };
  }
}

/** True if the user effectively holds any of the given permission(s). */
export async function userCan(
  permission: PermissionKey | PermissionKey[]
): Promise<boolean> {
  const { permissions } = await getCurrentPermissions();
  const wanted = Array.isArray(permission) ? permission : [permission];
  const held = new Set(permissions);
  return wanted.some((p) => held.has(p));
}

/**
 * Page/loader guard: redirect home if the user lacks ALL of the given
 * permission(s). Pass an array to mean "any of these grants access". No-op when
 * Supabase is unconfigured (dev gets full access via {@link getCurrentPermissions}).
 */
export async function requirePermission(
  permission: PermissionKey | PermissionKey[],
  redirectTo = "/"
): Promise<void> {
  if (await userCan(permission)) return;
  redirect(redirectTo);
}

/**
 * Server-action guard for ORG SETTINGS: throws unless the caller is the org
 * owner or holds the `admin` capability. Organization settings (members,
 * billing, accounting config, AI/skills) are admin-only — everyone else can
 * edit only their own profile. No-op when Supabase is unconfigured (dev gets
 * full access). The thrown message surfaces to the client action caller.
 */
export async function requireAdmin(): Promise<void> {
  if (!hasSupabase()) return;
  const { isOwner, permissions } = await getCurrentPermissions();
  if (isOwner || permissions.includes("admin")) return;
  throw new Error("Only an admin can change organization settings.");
}

/**
 * API route guard. Returns a 403 Response when the caller lacks (all of) the
 * given permission(s), or `null` when allowed — so a route can do:
 *
 *   const denied = await forbidUnlessPermitted("use_ai");
 *   if (denied) return denied;
 *
 * This is the server-side enforcement that DB RLS can't cover for work that
 * isn't a database operation (e.g. calling the AI model, hitting a vendor API).
 * Pass an array to mean "any of these grants access".
 */
export async function forbidUnlessPermitted(
  permission: PermissionKey | PermissionKey[]
): Promise<Response | null> {
  if (await userCan(permission)) return null;
  return Response.json(
    { error: "forbidden", reason: "missing_permission" },
    { status: 403 }
  );
}
