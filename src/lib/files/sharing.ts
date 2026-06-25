"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

/**
 * Resource sharing (Google Drive style). A file or folder is private to its
 * owner; these actions grant access to a specific workspace member or the whole
 * workspace. RLS (`resource_shares_write`) enforces that only someone who can
 * edit the resource may share it, so these run through the request-scoped client.
 */

export type ShareResourceType = "file" | "folder";
export type GranteeKind = "user" | "workspace";

export interface ResourceShare {
  id: string;
  granteeKind: GranteeKind;
  granteeId: string;
  /** Display label resolved for the UI (member name/email, or "Everyone"). */
  label: string;
  canEdit: boolean;
}

export interface ShareInput {
  resourceType: ShareResourceType;
  resourceId: string;
  granteeKind: GranteeKind;
  /** auth user id (user) or workspace id (workspace). */
  granteeId: string;
  canEdit?: boolean;
}

function revalidateSurfaces(): void {
  revalidatePath("/files");
  revalidatePath("/projects");
}

/** Grant (or update) access to a file/folder for a user or the whole workspace. */
export async function shareResource(input: ShareInput): Promise<void> {
  const user = await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb.from("resource_shares").upsert(
    {
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      grantee_kind: input.granteeKind,
      grantee_id: input.granteeId,
      can_edit: input.canEdit ?? false,
      created_by: user.id,
    },
    { onConflict: "resource_type,resource_id,grantee_kind,grantee_id" }
  );
  if (error) throw new Error(`shareResource: ${error.message}`);
  revalidateSurfaces();
}

/** Revoke a previously granted share. */
export async function unshareResource(
  resourceType: ShareResourceType,
  resourceId: string,
  granteeKind: GranteeKind,
  granteeId: string
): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("resource_shares")
    .delete()
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .eq("grantee_kind", granteeKind)
    .eq("grantee_id", granteeId);
  if (error) throw new Error(`unshareResource: ${error.message}`);
  revalidateSurfaces();
}

/** List who a file/folder is currently shared with (for the share dialog). */
export async function listShares(
  resourceType: ShareResourceType,
  resourceId: string
): Promise<ResourceShare[]> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("resource_shares")
    .select("id, grantee_kind, grantee_id, can_edit")
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId);
  if (error) throw new Error(`listShares: ${error.message}`);
  const rows = (data ?? []) as {
    id: string;
    grantee_kind: GranteeKind;
    grantee_id: string;
    can_edit: boolean;
  }[];

  // Resolve user grantees to a name/email for display.
  const userIds = rows
    .filter((r) => r.grantee_kind === "user")
    .map((r) => r.grantee_id);
  const labelByUser = new Map<string, string>();
  if (userIds.length) {
    const { data: members } = await sb
      .from("workspace_members")
      .select("user_id, name, email")
      .in("user_id", userIds);
    for (const m of (members ?? []) as {
      user_id: string;
      name: string | null;
      email: string | null;
    }[]) {
      labelByUser.set(m.user_id, m.name?.trim() || m.email || "Member");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    granteeKind: r.grantee_kind,
    granteeId: r.grantee_id,
    label:
      r.grantee_kind === "workspace"
        ? "Everyone in the workspace"
        : labelByUser.get(r.grantee_id) ?? "Member",
    canEdit: r.can_edit,
  }));
}

export interface SharePerson {
  userId: string;
  name: string;
  email: string;
}

/** The workspace's members, for the share picker (excludes the caller). */
export async function listShareTargets(): Promise<{
  workspaceId: string | null;
  people: SharePerson[];
}> {
  const user = await requireUser();
  const sb = await getSupabaseServer();
  const { data: workspaceId } = await sb.rpc("app_default_workspace_id");
  if (!workspaceId) return { workspaceId: null, people: [] };

  const { data, error } = await sb
    .from("workspace_members")
    .select("user_id, name, email")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`listShareTargets: ${error.message}`);

  const people = ((data ?? []) as {
    user_id: string;
    name: string | null;
    email: string | null;
  }[])
    .filter((m) => m.user_id !== user.id)
    .map((m) => ({
      userId: m.user_id,
      name: m.name?.trim() || m.email || "Member",
      email: m.email ?? "",
    }));

  return { workspaceId: workspaceId as string, people };
}
