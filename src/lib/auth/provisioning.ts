import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Ensure the signed-in user has a workspace, so tenant-scoped inserts (which
 * default `workspace_id` to `app_default_workspace_id()`) and per-user agent
 * context both work. Idempotent and cheap: a single indexed membership lookup on
 * the hot path, the create branch runs only once per user.
 *
 * Uses the admin (service-role) client because a brand-new user cannot satisfy
 * the workspace write policies until they are a member — this is the one-time
 * privileged bootstrap, mirroring how account creation already works.
 *
 * New workspaces get NO reference-data entitlements (rrc_data / enrichment); an
 * admin grants those later. The founder workspace was granted them in the
 * 20260625000200 backfill migration.
 */
export async function ensureWorkspace(user: User): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: existing, error: lookupErr } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (lookupErr) {
    console.error("ensureWorkspace lookup failed", lookupErr);
    return;
  }
  if (existing) return;

  const name = workspaceNameFor(user.email);
  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (wsErr || !ws) {
    console.error("ensureWorkspace create failed", wsErr);
    return;
  }
  const workspaceId = (ws as { id: string }).id;

  const { error: memberErr } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });
  if (memberErr) {
    console.error("ensureWorkspace member insert failed", memberErr);
    return;
  }

  // Seed this user's own copy of the agent context docs from the templates, and
  // an empty profile row so settings has a known key to upsert against.
  const [{ error: seedErr }, { error: profileErr }] = await Promise.all([
    admin.rpc("seed_agent_context", { p_owner: user.id }),
    admin
      .from("profile")
      .upsert({ user_id: user.id, name: "" }, { onConflict: "user_id" }),
  ]);
  if (seedErr) console.error("ensureWorkspace seed_agent_context failed", seedErr);
  if (profileErr) console.error("ensureWorkspace profile seed failed", profileErr);
}

/** Derive a friendly default workspace name from the sign-up email. */
function workspaceNameFor(email: string | undefined): string {
  const handle = email?.split("@")[0]?.trim();
  if (!handle) return "My Workspace";
  return `${handle}'s Workspace`;
}
