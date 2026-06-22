"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
} from "@/lib/auth/invite";
import { sendInviteEmail } from "@/lib/email/invite-email";
import {
  cleanPermissions,
  DEFAULT_PERMISSIONS,
  type PermissionKey,
} from "@/lib/settings/org";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export interface SaveProfileResult {
  name: string;
  companyName: string;
  avatarUrl: string | null;
  phone: string;
}

/** Short-lived signed URL for a private avatar object key (or pass-through). */
async function signedAvatar(key: string | null): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const { data } = await getSupabaseAdmin()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrl(key, 60 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Persist the signed-in user's profile. Accepts a FormData so the optional
 * avatar file and the text fields save in one round-trip. The profile row is
 * RLS-scoped to the user; the avatar object goes to the private bucket (admin)
 * and we store its key, returning a signed URL for immediate display.
 */
export async function saveProfile(
  formData: FormData
): Promise<SaveProfileResult> {
  const user = await requireUser();
  const sb = await getSupabaseServer();

  // Only fields actually present in the form are written — so the Profile
  // section (name + avatar + phone) and the Organization section (company name)
  // can each save independently without clobbering the other's fields. The
  // company name + address are ORG-level (shared by every member), so they go
  // on `organizations`, not the per-user profile (handled below).
  const update: {
    user_id: string;
    name?: string;
    avatar_url?: string;
    phone?: string;
  } = { user_id: user.id };

  if (formData.has("name")) update.name = String(formData.get("name")).trim();
  if (formData.has("phone")) update.phone = String(formData.get("phone")).trim();

  const avatar = formData.get("avatar");

  if (avatar instanceof File && avatar.size > 0) {
    if (!ALLOWED_AVATAR_TYPES.includes(avatar.type)) {
      throw new Error("Avatar must be a PNG, JPEG, WebP, or GIF image.");
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      throw new Error("Avatar must be 5 MB or smaller.");
    }
    // Unique key per upload (namespaced by user) so signed URLs change and CDNs
    // don't serve a stale image.
    const ext = avatar.name.split(".").pop()?.toLowerCase() || "png";
    const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = await avatar.arrayBuffer();
    const { error: upErr } = await getSupabaseAdmin()
      .storage.from(AVATAR_BUCKET)
      .upload(key, bytes, { contentType: avatar.type, upsert: false });
    if (upErr) throw new Error(`saveProfile (avatar upload): ${upErr.message}`);
    update.avatar_url = key;
  }

  const { data, error } = await sb
    .from("profile")
    .upsert(update, { onConflict: "user_id" })
    .select("name, avatar_url, phone")
    .single();
  if (error) throw new Error(`saveProfile: ${error.message}`);

  // Company name + address live on the organization (so every member sees the
  // same values), not the per-user profile. Filtering by owner_uid targets the
  // caller's org and makes a non-owner editor simply no-op; the org's owner-only
  // RLS write policy backs that up.
  const orgUpdate: { name?: string; company_address?: string } = {};
  if (formData.has("companyName"))
    orgUpdate.name = String(formData.get("companyName")).trim();
  if (formData.has("companyAddress"))
    orgUpdate.company_address = String(formData.get("companyAddress")).trim();
  if (Object.keys(orgUpdate).length > 0) {
    const { error: orgErr } = await sb
      .from("organizations")
      .update(orgUpdate)
      .eq("owner_uid", user.id);
    if (orgErr) throw new Error(`saveProfile (organization): ${orgErr.message}`);
  }

  // Read back the org name (the source of truth) to return as companyName.
  const { data: org } = await sb
    .from("organizations")
    .select("name")
    .maybeSingle<{ name: string | null }>();

  // The avatar + name show in the app shell (rendered by the root layout), so
  // revalidate the whole layout tree rather than a single route.
  revalidatePath("/", "layout");

  return {
    name: data.name ?? "",
    companyName: org?.name ?? "",
    avatarUrl: await signedAvatar(data.avatar_url ?? null),
    phone: data.phone ?? "",
  };
}

// --- Organization members --------------------------------------------------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface InviteResult {
  /** Email the invite link was delivered to. */
  email: string;
}

/**
 * Invite a member by name + email. Records an 'invited' row with the given
 * permissions (sanitised to the catalog; falls back to the default grant when
 * none are passed) and a secure, single-use, 7-day invite token. Only the
 * token's SHA-256 hash is stored; the raw token lives solely in the invite link
 * that is emailed to the invitee (see sendInviteEmail).
 *
 * The link is delivered by email only — it is never shown in the UI — so if the
 * email fails to send we delete the just-created pending row rather than leave
 * an invitee who can't be reached.
 */
export async function inviteMember(
  name: string,
  email: string,
  permissions?: PermissionKey[]
): Promise<InviteResult> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  const granted = permissions
    ? cleanPermissions(permissions)
    : DEFAULT_PERMISSIONS;

  const token = generateInviteToken();
  const { data: inserted, error } = await sb
    .from("org_members")
    .insert({
      name: name.trim(),
      email: normalized,
      is_owner: false,
      permissions: granted,
      status: "invited",
      invite_token_hash: hashInviteToken(token),
      invite_expires_at: inviteExpiry(Date.now()),
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = unique_violation: the email is already a member.
    if (error.code === "23505") {
      throw new Error("That person is already a member.");
    }
    throw new Error(`inviteMember: ${error.message}`);
  }

  try {
    await sendInviteEmail({ name: name.trim(), email: normalized, token });
  } catch (sendErr) {
    // Roll back so we don't leave an unreachable pending invite.
    await sb.from("org_members").delete().eq("id", inserted.id);
    const reason = sendErr instanceof Error ? sendErr.message : "unknown error";
    throw new Error(`Couldn't email the invite: ${reason}`);
  }

  revalidatePath("/settings");
  return { email: normalized };
}

/**
 * Replace a member's granted capabilities. The owner always has full access and
 * can't be edited here.
 */
export async function setMemberPermissions(
  id: string,
  permissions: PermissionKey[]
): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();

  const { data: member, error: readErr } = await sb
    .from("org_members")
    .select("is_owner")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`setMemberPermissions: ${readErr.message}`);
  if (member?.is_owner) {
    throw new Error("The owner's permissions can't be changed.");
  }

  const { error } = await sb
    .from("org_members")
    .update({ permissions: cleanPermissions(permissions) })
    .eq("id", id);
  if (error) throw new Error(`setMemberPermissions: ${error.message}`);
  revalidatePath("/settings");
}

/** Remove a member from the org. The owner can't be removed. */
export async function removeMember(id: string): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();

  const { data: member, error: readErr } = await sb
    .from("org_members")
    .select("is_owner")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`removeMember: ${readErr.message}`);
  if (member?.is_owner) {
    throw new Error("The owner can't be removed.");
  }

  const { error } = await sb.from("org_members").delete().eq("id", id);
  if (error) throw new Error(`removeMember: ${error.message}`);
  revalidatePath("/settings");
}

/**
 * Re-issue a pending member's invite: mint a fresh token (so the old link dies),
 * reset the 7-day expiry, clear any prior acceptance stamp, and email the new
 * link to the invitee. Only works on rows still 'invited'.
 */
export async function resendInvite(id: string): Promise<InviteResult> {
  await requireAdmin();
  const sb = await getSupabaseServer();

  const { data: member, error: readErr } = await sb
    .from("org_members")
    .select("status, name, email")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`resendInvite: ${readErr.message}`);
  if (!member) throw new Error("That invite no longer exists.");
  if (member.status !== "invited") {
    throw new Error("That member has already joined.");
  }

  const token = generateInviteToken();
  const { error } = await sb
    .from("org_members")
    .update({
      invite_token_hash: hashInviteToken(token),
      invite_expires_at: inviteExpiry(Date.now()),
      invite_accepted_at: null,
    })
    .eq("id", id)
    .eq("status", "invited");
  if (error) throw new Error(`resendInvite: ${error.message}`);

  try {
    await sendInviteEmail({
      name: member.name ?? "",
      email: member.email,
      token,
    });
  } catch (sendErr) {
    const reason = sendErr instanceof Error ? sendErr.message : "unknown error";
    throw new Error(`Couldn't email the invite: ${reason}`);
  }

  revalidatePath("/settings");
  return { email: member.email };
}

/**
 * Revoke a pending invite — deletes the 'invited' row so the link can no longer
 * be accepted. Refuses to touch active members (use `removeMember` for those).
 */
export async function cancelInvite(id: string): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();

  const { data: member, error: readErr } = await sb
    .from("org_members")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`cancelInvite: ${readErr.message}`);
  if (member && member.status !== "invited") {
    throw new Error("That member has already joined; remove them instead.");
  }

  const { error } = await sb
    .from("org_members")
    .delete()
    .eq("id", id)
    .eq("status", "invited");
  if (error) throw new Error(`cancelInvite: ${error.message}`);
  revalidatePath("/settings");
}
