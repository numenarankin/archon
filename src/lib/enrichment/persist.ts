/**
 * Glue between the scraper and the database: build an `EnrichTarget` from the
 * `operators_for_enrichment` SQL row, run match + score, and upsert the
 * resulting `operator_contacts` row. Shared by the bulk webhook and the
 * on-demand route.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EnrichTarget,
  OperatorContactRow,
  SkipTraceCandidate,
} from "./types";
import { matchCandidate } from "./match";
import { scoreEmail } from "./score";
import { parseOfficerName, personKey } from "./util";

/** A row returned by the `operators_for_enrichment` SQL function. */
export interface EnrichmentInputRow {
  operator_no: number;
  operator_name: string | null;
  officer_name: string;
  search_name: string;
  phone: string | null;
  state: string;
  city: string | null;
  zip: number | null;
  wells?: number;
}

/** Build an EnrichTarget from a selection row. */
export function toTarget(row: EnrichmentInputRow): EnrichTarget {
  const { first, last } = parseOfficerName(row.officer_name);
  return {
    operatorNo: row.operator_no,
    operatorName: row.operator_name,
    officerName: row.officer_name,
    firstName: first,
    lastName: last,
    searchName: row.search_name,
    phone: row.phone,
    state: row.state,
    city: row.city,
    zip: row.zip,
    personKey: personKey(row.officer_name, row.phone),
  };
}

/** Assemble the database row from a target + the matched/scored candidate. */
export function buildContactRow(
  target: EnrichTarget,
  candidates: SkipTraceCandidate[]
): OperatorContactRow {
  const match = matchCandidate(target, candidates);
  const score = scoreEmail(match);
  const c = match.candidate;

  return {
    operator_no: target.operatorNo,
    officer_name: target.officerName,
    person_key: target.personKey,
    best_email: c?.bestEmail ?? null,
    email_confidence: score.emailConfidence,
    email_grade: score.emailGrade,
    emails: c?.emails ?? [],
    best_phone: c?.bestPhone ?? null,
    phone_type: c?.phoneType ?? null,
    phone_live: c?.phoneLive ?? null,
    current_address: c?.currentAddress ?? null,
    age: c?.age ?? null,
    employer: c?.employer ?? null,
    occupation: c?.occupation ?? null,
    match_basis: match.basis,
    match_confidence: match.matchConfidence,
    sources: c?.sources ?? [],
    raw: c?.raw ?? null,
  };
}

/** Match, score, and upsert one target's result. Returns the stored row. */
export async function persistTarget(
  admin: SupabaseClient,
  target: EnrichTarget,
  candidates: SkipTraceCandidate[]
): Promise<OperatorContactRow> {
  const row = buildContactRow(target, candidates);
  const { error } = await admin
    .from("operator_contacts")
    .upsert(row, { onConflict: "operator_no,officer_name" });
  if (error) {
    throw new Error(`operator_contacts upsert failed: ${error.message}`);
  }
  return row;
}

/** All enrichment targets at/above a well threshold (bulk webhook mapping). */
export async function allTargets(
  admin: SupabaseClient,
  minWells: number
): Promise<EnrichTarget[]> {
  const { data, error } = await admin.rpc("operators_for_enrichment", {
    p_min_wells: minWells,
    p_operator: null,
  });
  if (error) throw new Error(`operators_for_enrichment failed: ${error.message}`);
  return ((data ?? []) as EnrichmentInputRow[]).map(toTarget);
}
