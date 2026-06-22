import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

/** The person categories shown on the People page. */
export type PeopleCategory =
  | "contractors"
  | "service-providers"
  | "royalty-owners";

/**
 * An independent contractor who performs field work for the operator
 * (pumpers, roustabouts, welders, electricians, etc.).
 */
export interface Contractor {
  id: string;
  name: string;
  company: string;
  /** Trade / specialty, e.g. "Pumper", "Welder". */
  trade: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive";
  /** Free-form notes about the contractor. */
  description: string;
}

/**
 * A company the operator buys services from (well servicing, trucking,
 * chemical, wireline, etc.).
 */
export interface ServiceProvider {
  id: string;
  company: string;
  /** Category of service provided. */
  service: string;
  /** Primary contact name. */
  contact: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive";
  /** Free-form notes about the service provider. */
  description: string;
}

/**
 * A holder of a royalty / mineral interest who receives revenue payments.
 */
export interface RoyaltyOwner {
  id: string;
  name: string;
  /** Type of interest held. */
  interestType: "Royalty" | "Overriding" | "Mineral";
  /** Net decimal interest (fraction of production revenue). */
  decimalInterest: number;
  /** IDs of the wells the owner holds an interest in. */
  wellIds: string[];
  /** Contact email address. */
  email: string;
  /** Mailing address for revenue checks and correspondence. */
  mailingAddress: string;
  /** Most recent monthly payment, in US dollars. */
  lastPayment: number;
  /** Free-form notes about the royalty owner. */
  description: string;
}

export async function getContractors(): Promise<Contractor[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("contractors")
    .select("id, name, company, trade, phone, email, status, description")
    .order("name");
  if (error) throw new Error(`getContractors: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    company: r.company ?? "",
    trade: r.trade ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    status: r.status,
    description: r.description ?? "",
  }));
}

export async function getServiceProviders(): Promise<ServiceProvider[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("service_providers")
    .select("id, company, service, contact, phone, email, status, description")
    .order("company");
  if (error) throw new Error(`getServiceProviders: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    company: r.company,
    service: r.service ?? "",
    contact: r.contact ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    status: r.status,
    description: r.description ?? "",
  }));
}

interface RoyaltyOwnerRow {
  id: string;
  name: string;
  interest_type: "Royalty" | "Overriding" | "Mineral";
  decimal_interest: number;
  email: string | null;
  mailing_address: string | null;
  last_payment: number | null;
  description: string | null;
  royalty_owner_wells: { well_id: string }[] | null;
}

function mapRoyaltyOwner(r: RoyaltyOwnerRow): RoyaltyOwner {
  return {
    id: r.id,
    name: r.name,
    interestType: r.interest_type,
    decimalInterest: r.decimal_interest,
    wellIds: (r.royalty_owner_wells ?? []).map((w) => w.well_id),
    email: r.email ?? "",
    mailingAddress: r.mailing_address ?? "",
    lastPayment: r.last_payment ?? 0,
    description: r.description ?? "",
  };
}

export async function getRoyaltyOwners(): Promise<RoyaltyOwner[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("royalty_owners")
    .select(
      "id, name, interest_type, decimal_interest, email, mailing_address, last_payment, description, royalty_owner_wells(well_id)"
    )
    .order("name");
  if (error) throw new Error(`getRoyaltyOwners: ${error.message}`);
  return ((data ?? []) as RoyaltyOwnerRow[]).map(mapRoyaltyOwner);
}

/**
 * Returns the royalty owners that hold an interest in a given well.
 */
export async function getWellRoyaltyOwners(
  wellId: string
): Promise<RoyaltyOwner[]> {
  const owners = await getRoyaltyOwners();
  return owners.filter((owner) => owner.wellIds.includes(wellId));
}
