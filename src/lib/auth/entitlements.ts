import "server-only";

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Feature entitlements granted to the caller's workspace(s). These gate access to
 * the shared reference datasets, enforced at the database layer by RLS
 * (`app_has_entitlement(...)`). This helper is the UI-side mirror so screens can
 * hide RRC / enrichment features a workspace is not entitled to. The DB remains
 * the real boundary; a missing UI check cannot leak data.
 */

export type Entitlement = "rrc_data" | "enrichment";

/** The set of entitlements the current user holds (via any of their workspaces). */
export async function getEntitlements(): Promise<Set<Entitlement>> {
  // Running without Supabase (local dev / open mode) grants everything.
  if (!hasSupabase()) return new Set<Entitlement>(["rrc_data", "enrichment"]);
  try {
    const sb = await getSupabaseServer();
    // RLS scopes this to the caller's workspaces.
    const { data, error } = await sb
      .from("workspace_entitlements")
      .select("feature");
    if (error) throw error;
    return new Set(
      ((data ?? []) as { feature: string }[]).map((r) => r.feature as Entitlement)
    );
  } catch (error) {
    console.error("getEntitlements failed", error);
    return new Set<Entitlement>();
  }
}

/** Whether the current user's workspace is entitled to a given feature. */
export async function hasEntitlement(feature: Entitlement): Promise<boolean> {
  return (await getEntitlements()).has(feature);
}
