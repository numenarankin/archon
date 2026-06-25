/**
 * Server-only validation of an invite token for rendering the accept page.
 *
 * Mirrors the checks the accept route enforces (hash match, pending, not
 * expired) but read-only: it just tells the page whether to show the form (and
 * for which email) or an error. The authoritative re-check still happens in the
 * accept route — never trust a page-load validation alone.
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { hashInviteToken } from "@/lib/auth/invite";

export type InviteLookup =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "accepted" | "expired" | "unavailable" };

/** Validate a raw invite token; returns the invited email when usable. */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!hasSupabase()) return { ok: false, reason: "unavailable" };
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("workspace_invites")
      .select("email, expires_at, accepted_at")
      .eq("invite_token_hash", hashInviteToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: "invalid" };

    const row = data as {
      email: string;
      expires_at: string | null;
      accepted_at: string | null;
    };
    if (row.accepted_at) return { ok: false, reason: "accepted" };
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, email: row.email };
  } catch (err) {
    console.error("lookupInvite failed", err);
    return { ok: false, reason: "unavailable" };
  }
}
