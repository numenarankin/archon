"use server";

import { getProspectingClient } from "@/lib/numena/prospecting-supabase";
import { requirePermission } from "@/lib/auth/permissions";
import type { IssuerPerson, IssuerProfile } from "@/lib/numena/prospecting";

interface IssuerRow {
  cik: string | null;
  name: string | null;
  jurisdiction: string | null;
  entity_type: string | null;
  year_of_inception: number | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
}

interface OfferingRow {
  industry_group: string | null;
  total_offering: number | null;
  total_sold: number | null;
  total_remaining: number | null;
  min_investment: number | null;
  securities_types: string[] | null;
  date_first_sale: string | null;
  num_total_investors: number | null;
  num_non_accred: number | null;
  rule_506b: boolean;
  rule_506c: boolean;
  rule_504: boolean;
}

interface PersonRow {
  name: string | null;
  relationship: string[] | null;
  address_city: string | null;
  address_state: string | null;
}

function exemptionLabel(o: OfferingRow | null): string {
  if (!o) return "—";
  if (o.rule_506c) return "506(c)";
  if (o.rule_506b) return "506(b)";
  if (o.rule_504) return "504";
  return "—";
}

/** "City, ST" → "City" → "ST" → "" */
function personLocation(city: string | null, state: string | null): string {
  const c = city?.trim();
  const s = state?.trim();
  if (c && s) return `${c}, ${s}`;
  return c || s || "";
}

/** Assemble "street, city, ST zip" from the issuer address parts. */
function issuerAddress(row: IssuerRow): string | null {
  const cityState = [row.address_city?.trim(), row.address_state?.trim()]
    .filter(Boolean)
    .join(", ");
  const tail = [cityState, row.address_zip?.trim()].filter(Boolean).join(" ");
  const full = [row.address_street?.trim(), tail].filter(Boolean).join(", ");
  return full || null;
}

/**
 * Fetch the full issuer profile for a single filing, on demand. Reads the
 * primary issuer, the offering, and the related people from the prospecting
 * Supabase project. Returns null when the project is unconfigured or the
 * accession is unknown.
 */
export async function getIssuerProfile(
  accessionNo: string
): Promise<IssuerProfile | null> {
  await requirePermission("view_prospects");

  const sb = getProspectingClient();
  if (!sb) return null;

  const [issuerRes, offeringRes, peopleRes] = await Promise.all([
    sb
      .from("form_d_issuers")
      .select(
        "cik, name, jurisdiction, entity_type, year_of_inception, address_street, address_city, address_state, address_zip, phone"
      )
      .eq("accession_no", accessionNo)
      .eq("issuer_seq", 1)
      .maybeSingle(),
    sb
      .from("form_d_offerings")
      .select(
        "industry_group, total_offering, total_sold, total_remaining, min_investment, securities_types, date_first_sale, num_total_investors, num_non_accred, rule_506b, rule_506c, rule_504"
      )
      .eq("accession_no", accessionNo)
      .maybeSingle(),
    sb
      .from("form_d_related_persons")
      .select("name, relationship, address_city, address_state")
      .eq("accession_no", accessionNo)
      .order("person_seq", { ascending: true }),
  ]);

  if (issuerRes.error) {
    console.error("[numena] getIssuerProfile issuer:", issuerRes.error.message);
    return null;
  }
  const issuer = issuerRes.data as IssuerRow | null;
  if (!issuer) return null;

  const offering = (offeringRes.data ?? null) as OfferingRow | null;
  const people: IssuerPerson[] = ((peopleRes.data ?? []) as PersonRow[]).map(
    (p) => ({
      name: p.name ?? "Unknown",
      relationships: p.relationship ?? [],
      location: personLocation(p.address_city, p.address_state),
    })
  );

  return {
    accessionNo,
    name: issuer.name ?? "Unknown issuer",
    cik: issuer.cik || null,
    jurisdiction: issuer.jurisdiction,
    entityType: issuer.entity_type,
    yearOfInception: issuer.year_of_inception,
    address: issuerAddress(issuer),
    phone: issuer.phone || null,
    industry: offering?.industry_group ?? null,
    exemption: exemptionLabel(offering),
    totalOffering: offering?.total_offering ?? null,
    totalSold: offering?.total_sold ?? null,
    totalRemaining: offering?.total_remaining ?? null,
    minInvestment: offering?.min_investment ?? null,
    securitiesTypes: offering?.securities_types ?? [],
    dateFirstSale: offering?.date_first_sale ?? null,
    numTotalInvestors: offering?.num_total_investors ?? null,
    numNonAccred: offering?.num_non_accred ?? null,
    people,
  };
}
