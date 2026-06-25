/**
 * Server-only data access for org members. Kept separate from `./org` (pure
 * types + the permission catalog) so the client components that import the
 * catalog don't drag the request-scoped Supabase client — and `next/headers` —
 * into the browser bundle.
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { describeError, isAbsentRelation } from "@/lib/supabase/errors";
import {
  cleanPermissions,
  type MemberStatus,
  type OrgMember,
} from "@/lib/settings/org";

interface MemberRow {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  permissions: string[] | null;
}

interface InviteRow {
  id: string;
  invited_name: string | null;
  email: string;
  permissions: string[] | null;
}

/**
 * The workspace roster: active members (keyed by their auth user id) merged with
 * pending invites (keyed by invite id). Owner pinned first. status distinguishes
 * the two so the settings UI routes edits to the right action.
 */
export async function getOrgMembers(): Promise<OrgMember[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = await getSupabaseServer();
    const { data: workspaceId } = await sb.rpc("app_default_workspace_id");
    if (!workspaceId) return [];

    const [memberRes, inviteRes] = await Promise.all([
      sb
        .from("workspace_members")
        .select("user_id, role, name, email, permissions")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      sb
        .from("workspace_invites")
        .select("id, invited_name, email, permissions")
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .order("created_at", { ascending: true }),
    ]);
    if (memberRes.error) throw memberRes.error;
    if (inviteRes.error) throw inviteRes.error;

    const memberRows = (memberRes.data ?? []) as MemberRow[];

    // Resolve each member's display name + avatar from their profile. Profiles
    // are RLS-scoped to their owner, so read with the admin client, limited to
    // this workspace's confirmed members.
    const userIds = memberRows.map((r) => r.user_id);
    const profileByUser = new Map<
      string,
      { name: string | null; avatar_url: string | null }
    >();
    if (userIds.length) {
      const { data: profiles } = await getSupabaseAdmin()
        .from("profile")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      for (const p of (profiles ?? []) as {
        user_id: string;
        name: string | null;
        avatar_url: string | null;
      }[]) {
        profileByUser.set(p.user_id, { name: p.name, avatar_url: p.avatar_url });
      }
    }

    const activeMembers: OrgMember[] = memberRows.map((r) => {
      const prof = profileByUser.get(r.user_id);
      const isOwner = r.role === "owner";
      // Owner shows as full access (isOwner); an admin-role member surfaces the
      // 'admin' capability; everyone else shows their granted set.
      const permissions = isOwner
        ? []
        : r.role === "admin"
          ? cleanPermissions(["admin", ...(r.permissions ?? [])])
          : cleanPermissions(r.permissions ?? []);
      return {
        id: r.user_id,
        name: prof?.name?.trim() || r.name || "",
        email: r.email ?? "",
        isOwner,
        permissions,
        status: "active" as MemberStatus,
        avatarUrl: prof?.avatar_url ?? null,
      };
    });

    const pendingInvites: OrgMember[] = (
      (inviteRes.data ?? []) as InviteRow[]
    ).map((r) => ({
      id: r.id,
      name: r.invited_name ?? "",
      email: r.email,
      isOwner: false,
      permissions: cleanPermissions(r.permissions ?? []),
      status: "invited" as MemberStatus,
      avatarUrl: null,
    }));

    return [...activeMembers, ...pendingInvites].sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (b.isOwner && !a.isOwner) return 1;
      return 0;
    });
  } catch (error) {
    if (!isAbsentRelation(error)) {
      console.warn("getOrgMembers unavailable:", describeError(error));
    }
    return [];
  }
}
