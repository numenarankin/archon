"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  Contractor,
  RoyaltyOwner,
  ServiceProvider,
} from "@/lib/people/people";

export type ContractorInput = Omit<Contractor, "id">;
export type ServiceProviderInput = Omit<ServiceProvider, "id">;
export type RoyaltyOwnerInput = Omit<RoyaltyOwner, "id">;

/**
 * Pages that surface people data and should re-fetch after a write. Tasks is
 * included because its assignee list is built from the contractors table.
 */
const PEOPLE_PATHS = ["/people", "/tasks"];

function revalidatePeople(): void {
  for (const path of PEOPLE_PATHS) revalidatePath(path);
}

/** Create a contractor. */
export async function createContractor(
  input: ContractorInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("contractors").insert({
    name: input.name,
    company: input.company || null,
    trade: input.trade || null,
    phone: input.phone || null,
    email: input.email || null,
    status: input.status,
    description: input.description || null,
  });
  if (error) throw new Error(`createContractor: ${error.message}`);
  revalidatePeople();
}

/** Update an existing contractor. */
export async function updateContractor(
  id: string,
  input: ContractorInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("contractors")
    .update({
      name: input.name,
      company: input.company || null,
      trade: input.trade || null,
      phone: input.phone || null,
      email: input.email || null,
      status: input.status,
      description: input.description || null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateContractor: ${error.message}`);
  revalidatePeople();
}

/** Create a service provider. */
export async function createServiceProvider(
  input: ServiceProviderInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("service_providers").insert({
    company: input.company,
    service: input.service || null,
    contact: input.contact || null,
    phone: input.phone || null,
    email: input.email || null,
    status: input.status,
    description: input.description || null,
  });
  if (error) throw new Error(`createServiceProvider: ${error.message}`);
  revalidatePeople();
}

/** Update an existing service provider. */
export async function updateServiceProvider(
  id: string,
  input: ServiceProviderInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("service_providers")
    .update({
      company: input.company,
      service: input.service || null,
      contact: input.contact || null,
      phone: input.phone || null,
      email: input.email || null,
      status: input.status,
      description: input.description || null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateServiceProvider: ${error.message}`);
  revalidatePeople();
}

/** Create a royalty owner, plus its well-interest links. */
export async function createRoyaltyOwner(
  input: RoyaltyOwnerInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("royalty_owners")
    .insert({
      name: input.name,
      interest_type: input.interestType,
      decimal_interest: input.decimalInterest,
      email: input.email || null,
      mailing_address: input.mailingAddress || null,
      last_payment: input.lastPayment,
      description: input.description || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createRoyaltyOwner: ${error.message}`);

  if (input.wellIds.length > 0) {
    const links = input.wellIds.map((wellId) => ({
      royalty_owner_id: data.id,
      well_id: wellId,
    }));
    const { error: linkError } = await sb
      .from("royalty_owner_wells")
      .insert(links);
    if (linkError) throw new Error(`createRoyaltyOwner: ${linkError.message}`);
  }

  revalidatePeople();
}

/** Update an existing royalty owner, re-syncing its well-interest links. */
export async function updateRoyaltyOwner(
  id: string,
  input: RoyaltyOwnerInput
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("royalty_owners")
    .update({
      name: input.name,
      interest_type: input.interestType,
      decimal_interest: input.decimalInterest,
      email: input.email || null,
      mailing_address: input.mailingAddress || null,
      last_payment: input.lastPayment,
      description: input.description || null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateRoyaltyOwner: ${error.message}`);

  // Replace the well links wholesale: clear the existing set, then re-insert.
  const { error: clearError } = await sb
    .from("royalty_owner_wells")
    .delete()
    .eq("royalty_owner_id", id);
  if (clearError) throw new Error(`updateRoyaltyOwner: ${clearError.message}`);

  if (input.wellIds.length > 0) {
    const links = input.wellIds.map((wellId) => ({
      royalty_owner_id: id,
      well_id: wellId,
    }));
    const { error: linkError } = await sb
      .from("royalty_owner_wells")
      .insert(links);
    if (linkError) throw new Error(`updateRoyaltyOwner: ${linkError.message}`);
  }

  revalidatePeople();
}
