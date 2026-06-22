/**
 * Server-side access to the signed-in user's profile (`profile` table, one row
 * per auth user): display name, company name, and avatar. Read in server
 * components; written via `./actions`.
 *
 * RLS returns only the caller's own row, so reads don't filter by id. The
 * avatar is stored as a private-bucket object key and served as a short-lived
 * signed URL (the bucket is no longer public).
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

const AVATAR_BUCKET = "avatars";

export interface Profile {
  name: string;
  companyName: string;
  avatarUrl: string | null;
  /** Optional contact phone, stored on the profile row. */
  phone: string;
  /** The signed-in user's email, read from auth (not editable here). */
  email: string;
}

const EMPTY_PROFILE: Profile = {
  name: "",
  companyName: "",
  avatarUrl: null,
  phone: "",
  email: "",
};

/** Mint a signed URL for a stored avatar object key (tolerating legacy URLs). */
async function signedAvatar(key: string | null): Promise<string | null> {
  if (!key) return null;
  // Pre-migration rows may hold a full public URL; pass those through.
  if (key.startsWith("http")) return key;
  const { data } = await getSupabaseAdmin()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrl(key, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Load the signed-in user's profile, or empty defaults when unavailable. */
export async function getProfile(): Promise<Profile> {
  if (!hasSupabase()) return EMPTY_PROFILE;
  try {
    const sb = await getSupabaseServer();
    // The company name is org-level (shared by every member), so it comes from
    // `organizations`, not the per-user profile. RLS scopes both reads to the
    // caller: their own profile row and their own org.
    const [{ data, error }, { data: org }] = await Promise.all([
      sb.from("profile").select("name, avatar_url, phone").maybeSingle(),
      sb
        .from("organizations")
        .select("name")
        .maybeSingle<{ name: string | null }>(),
    ]);
    if (error) throw error;
    const email = (await getSessionUser())?.email ?? "";
    const companyName = org?.name ?? "";
    if (!data) return { ...EMPTY_PROFILE, companyName, email };
    return {
      name: (data.name ?? "").trim(),
      companyName,
      avatarUrl: await signedAvatar(data.avatar_url),
      phone: (data.phone ?? "").trim(),
      email,
    };
  } catch (error) {
    console.error("getProfile failed", error);
    return EMPTY_PROFILE;
  }
}
