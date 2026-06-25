/**
 * Server-only read access to the caller's workspace (the one they own or are a
 * member of). Kept apart from `./org` (pure types) so client bundles don't drag
 * in the server client.
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { describeError, isAbsentRelation } from "@/lib/supabase/errors";

export interface OrgInfo {
  id: string;
  name: string;
  companyAddress: string | null;
  employeeCount: number | null;
  wellCount: number | null;
  onboardingCompleted: boolean;
}

interface OrgRow {
  id: string;
  name: string | null;
  company_address: string | null;
  employee_count: number | null;
  well_count: number | null;
  onboarding_completed_at: string | null;
}

function mapOrg(r: OrgRow): OrgInfo {
  return {
    id: r.id,
    name: r.name ?? "",
    companyAddress: r.company_address,
    employeeCount: r.employee_count,
    wellCount: r.well_count,
    onboardingCompleted: r.onboarding_completed_at !== null,
  };
}

/**
 * The caller's primary workspace, or null when unavailable. RLS scopes the
 * select to workspaces the caller belongs to; we take their default (primary)
 * one.
 */
export async function getOrgInfo(): Promise<OrgInfo | null> {
  if (!hasSupabase()) return null;
  try {
    const sb = await getSupabaseServer();
    const { data: workspaceId } = await sb.rpc("app_default_workspace_id");
    if (!workspaceId) return null;
    const { data, error } = await sb
      .from("workspaces")
      .select(
        "id, name, company_address, employee_count, well_count, onboarding_completed_at"
      )
      .eq("id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapOrg(data as OrgRow) : null;
  } catch (error) {
    if (!isAbsentRelation(error)) {
      console.warn("getOrgInfo unavailable:", describeError(error));
    }
    return null;
  }
}
