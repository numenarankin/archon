"use server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Connect the signed-in user to any org membership invited for their email.
 *
 * Run right after sign-in. Until this links `auth_user_id`, an invited member
 * can't satisfy org RLS (which keys on `auth_user_id = auth.uid()`), so this
 * MUST use the admin client to bypass RLS for the one-time link. Marks the row
 * active so the invite is accepted. Idempotent.
 */
export async function linkMembership(): Promise<void> {
  const user = await getSessionUser();
  if (!user?.email) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("org_members")
    .update({ auth_user_id: user.id, status: "active" })
    .ilike("email", user.email)
    .is("auth_user_id", null);
  if (error) console.error("linkMembership failed", error);
}
