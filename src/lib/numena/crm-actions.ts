"use server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

/**
 * Add / remove a Form D issuer to the CRM from the prospecting modal. The issuer
 * becomes a durable `crm_accounts` record in the NUMENA business unit at the
 * first lifecycle stage ('lead'), linked back to the filing via source_kind /
 * source_ref so it dedupes (the same issuer added from any filing maps to one
 * account) and the modal's add/remove toggle stays in sync.
 */

const SOURCE_KIND = "formd_issuer";

/** The Numena business unit for the caller's workspace, or null. */
async function numenaUnitId(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>
): Promise<string | null> {
  const { data } = await sb
    .from("business_units")
    .select("id")
    .eq("key", "numena")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Whether this issuer is already in the CRM (drives the +/✓ button state). */
export async function getIssuerCrmState(
  sourceRef: string
): Promise<{ inCrm: boolean }> {
  if (!sourceRef) return { inCrm: false };
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("crm_accounts")
    .select("id")
    .eq("source_kind", SOURCE_KIND)
    .eq("source_ref", sourceRef)
    .maybeSingle();
  return { inCrm: Boolean(data) };
}

export interface AddIssuerInput {
  /** Stable issuer ref — CIK when present, else the filing accession number. */
  sourceRef: string;
  name: string;
  industry?: string | null;
  phone?: string | null;
  address?: string | null;
  entityType?: string | null;
  jurisdiction?: string | null;
  exemption?: string | null;
  totalOffering?: number | null;
  accessionNo?: string | null;
}

export async function addIssuerToCrm(
  input: AddIssuerInput
): Promise<{ inCrm: true }> {
  await requirePermission("view_prospects");
  const sb = await getSupabaseServer();

  // Idempotent: if it's already there, we're done.
  if ((await getIssuerCrmState(input.sourceRef)).inCrm) return { inCrm: true };

  const businessUnitId = await numenaUnitId(sb);
  if (!businessUnitId) throw new Error("Numena business unit not found.");

  const { data: account, error } = await sb
    .from("crm_accounts")
    .insert({
      business_unit_id: businessUnitId,
      name: input.name,
      kind: "issuer",
      lifecycle: "lead", // first stage of the lifecycle classification
      phone: input.phone ?? null,
      address: input.address ?? null,
      industry: input.industry ?? null,
      source_kind: SOURCE_KIND,
      source_ref: input.sourceRef,
      custom: {
        entityType: input.entityType ?? null,
        jurisdiction: input.jurisdiction ?? null,
        exemption: input.exemption ?? null,
        totalOffering: input.totalOffering ?? null,
        accessionNo: input.accessionNo ?? null,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(`addIssuerToCrm: ${error.message}`);
  const accountId = (account as { id: string }).id;

  // Bridge: enqueue the issuer on the Numena sales desk as an Unscheduled
  // prospect (queue_day null) linked to the durable account. Deleting the
  // account later cascades this row away (crm_account_id on delete cascade).
  const dossier = [
    input.entityType && { label: "Entity", value: input.entityType },
    input.jurisdiction && { label: "Jurisdiction", value: input.jurisdiction },
    input.exemption && { label: "Exemption", value: input.exemption },
    input.industry && { label: "Industry", value: input.industry },
    input.totalOffering != null && {
      label: "Offering",
      value: `$${Math.round(input.totalOffering).toLocaleString("en-US")}`,
    },
    input.address && { label: "Address", value: input.address },
  ].filter(Boolean);

  const { error: deskErr } = await sb.from("sales_prospects").insert({
    business_unit_id: businessUnitId,
    crm_account_id: accountId,
    name: input.name,
    company: input.name,
    phone: input.phone ?? "",
    location: input.address ?? null,
    status: "new",
    queue_day: null, // unscheduled inbox
    sort_order: 0,
    hook: input.industry ?? null,
    dossier,
  });
  if (deskErr) throw new Error(`addIssuerToCrm (desk): ${deskErr.message}`);
  return { inCrm: true };
}

export async function removeIssuerFromCrm(
  sourceRef: string
): Promise<{ inCrm: false }> {
  await requirePermission("view_prospects");
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("crm_accounts")
    .delete()
    .eq("source_kind", SOURCE_KIND)
    .eq("source_ref", sourceRef);
  if (error) throw new Error(`removeIssuerFromCrm: ${error.message}`);
  return { inCrm: false };
}
