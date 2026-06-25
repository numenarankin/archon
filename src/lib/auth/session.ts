import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { ensureWorkspace } from "@/lib/auth/provisioning";

/**
 * The signed-in user, or null. Reads the session from the request cookies via
 * the request-scoped client. `getUser()` (not `getSession()`) re-validates the
 * JWT against Supabase Auth, so this is safe to trust on the server.
 *
 * Without Supabase configured the app runs "open" (see proxy + permissions),
 * so there is no session to read — return null rather than constructing a
 * client that would throw.
 */
export async function getSessionUser(): Promise<User | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ?? null;
}

/**
 * Hard auth gate for server code (server actions, page/layout loaders). Returns
 * the user or redirects to /auth. This is the real boundary; Proxy only does
 * the cheap optimistic redirect.
 */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  // Guarantee the user has a workspace before any tenant-scoped work runs. This
  // is the chokepoint every page/loader/action passes through, and it is
  // idempotent (one indexed membership lookup on the warm path).
  await ensureWorkspace(user);
  return user;
}
