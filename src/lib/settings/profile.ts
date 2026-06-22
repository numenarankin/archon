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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Postgres/PostgREST codes that are transient and worth retrying — chiefly a
 *  cold schema cache (PGRST002), which clears once PostgREST finishes loading. */
function isTransient(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "PGRST002" || code === "PGRST001" || code === "57P03";
}

/**
 * Read the singleton profile row, retrying briefly on a transient schema-cache
 * miss. Right after the database wakes (a paused project, a just-started local
 * stack) PostgREST can answer with PGRST002 before its cache is warm; a couple
 * of short retries let the first page load succeed instead of flashing an error.
 */
async function readProfileRow(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>
) {
  const DELAYS = [200, 500, 900];
  let result = await sb.from("profile").select("name, avatar_url, phone").maybeSingle();
  for (let i = 0; result.error && isTransient(result.error) && i < DELAYS.length; i++) {
    await sleep(DELAYS[i]);
    result = await sb.from("profile").select("name, avatar_url, phone").maybeSingle();
  }
  return result;
}

/** Load the signed-in user's profile, or empty defaults when unavailable. */
export async function getProfile(): Promise<Profile> {
  if (!hasSupabase()) return EMPTY_PROFILE;
  try {
    const sb = await getSupabaseServer();
    // The live schema has no `organizations` table (this app is single-org by
    // design — see the auth note in the init migration), so company name is not
    // sourced here; it stays empty until a home for it exists. RLS scopes the
    // profile read to the caller's own row.
    const [{ data, error }, user] = await Promise.all([
      readProfileRow(sb),
      getSessionUser(),
    ]);
    if (error) throw error;
    const email = user?.email ?? "";
    if (!data) return { ...EMPTY_PROFILE, email };
    return {
      name: (data.name ?? "").trim(),
      companyName: "",
      avatarUrl: await signedAvatar(data.avatar_url),
      phone: (data.phone ?? "").trim(),
      email,
    };
  } catch (error) {
    // A transient cache miss that outlived the retries isn't worth an error-
    // level overlay; warn instead. The app shell still renders with defaults.
    console.warn("getProfile unavailable:", describeError(error));
    return EMPTY_PROFILE;
  }
}

/** Extract a readable message from an Error or a Supabase PostgrestError. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; code?: string; hint?: string };
    if (e.message) return `${e.message}${e.code ? ` (${e.code})` : ""}`;
    return JSON.stringify(error);
  }
  return String(error);
}
