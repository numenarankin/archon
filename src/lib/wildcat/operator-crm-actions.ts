"use server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

/**
 * Add / remove an RRC operator to the CRM from the prospecting modal. The
 * operator becomes a durable `crm_accounts` record in the WILDCAT business unit
 * at the first lifecycle stage ('lead'), linked back to the RRC intel via
 * source_kind / source_ref (the operator number) so it dedupes — the same
 * operator added from anywhere maps to one account — and the modal's add/remove
 * toggle stays in sync. Mirrors the Numena issuer flow in
 * `@/lib/numena/crm-actions`.
 */

const SOURCE_KIND = "rrc_operator";

/** The Wildcat business unit for the caller's workspace, or null. */
async function wildcatUnitId(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>
): Promise<string | null> {
  const { data } = await sb
    .from("business_units")
    .select("id")
    .eq("key", "wildcat")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Whether this operator is already in the CRM (drives the +/✓ button state). */
export async function getOperatorCrmState(
  operatorNumber: number
): Promise<{ inCrm: boolean }> {
  if (!operatorNumber) return { inCrm: false };
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("crm_accounts")
    .select("id")
    .eq("source_kind", SOURCE_KIND)
    .eq("source_ref", String(operatorNumber))
    .maybeSingle();
  return { inCrm: Boolean(data) };
}

export interface AddOperatorInput {
  operatorNumber: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: number | null;
  p5Status?: string | null;
  wellCount?: number | null;
}

export async function addOperatorToCrm(
  input: AddOperatorInput
): Promise<{ inCrm: true }> {
  await requirePermission("view_map");
  const sb = await getSupabaseServer();

  // Idempotent: if it's already there, we're done.
  if ((await getOperatorCrmState(input.operatorNumber)).inCrm) {
    return { inCrm: true };
  }

  const businessUnitId = await wildcatUnitId(sb);
  if (!businessUnitId) throw new Error("Wildcat business unit not found.");

  const { data: account, error } = await sb
    .from("crm_accounts")
    .insert({
      business_unit_id: businessUnitId,
      name: input.name,
      kind: "operator",
      lifecycle: "lead", // first stage of the lifecycle classification
      phone: input.phone ?? null,
      address: input.address ?? null,
      source_kind: SOURCE_KIND,
      source_ref: String(input.operatorNumber),
      custom: {
        operatorNumber: input.operatorNumber,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        p5Status: input.p5Status ?? null,
        wellCount: input.wellCount ?? null,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(`addOperatorToCrm: ${error.message}`);
  const accountId = (account as { id: string }).id;

  // Bridge: enqueue the operator on the Wildcat sales desk as an Unscheduled
  // prospect (queue_day null) linked to the durable account. Deleting the
  // account later cascades this row away (crm_account_id on delete cascade).
  const location = [input.city, input.state].filter(Boolean).join(", ");
  const dossier = [
    input.p5Status && { label: "P-5 status", value: input.p5Status },
    input.wellCount != null && {
      label: "Wells operated",
      value: String(input.wellCount),
    },
    location && { label: "Location", value: location },
    input.address && { label: "Address", value: input.address },
    { label: "Operator no.", value: String(input.operatorNumber) },
  ].filter(Boolean);

  const { error: deskErr } = await sb.from("sales_prospects").insert({
    business_unit_id: businessUnitId,
    crm_account_id: accountId,
    name: input.name,
    company: input.name,
    phone: input.phone ?? "",
    location: location || input.address || null,
    status: "new",
    queue_day: null, // unscheduled inbox
    sort_order: 0,
    hook: input.wellCount != null ? `${input.wellCount} wells` : null,
    dossier,
  });
  if (deskErr) throw new Error(`addOperatorToCrm (desk): ${deskErr.message}`);
  return { inCrm: true };
}

export async function removeOperatorFromCrm(
  operatorNumber: number
): Promise<{ inCrm: false }> {
  await requirePermission("view_map");
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("crm_accounts")
    .delete()
    .eq("source_kind", SOURCE_KIND)
    .eq("source_ref", String(operatorNumber));
  if (error) throw new Error(`removeOperatorFromCrm: ${error.message}`);
  return { inCrm: false };
}
