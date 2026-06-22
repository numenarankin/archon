/**
 * Shared types for the operator-contact enrichment pipeline.
 *
 * Flow: a `EnrichTarget` (our top decision-maker, from the P-5) is sent to the
 * Skip Trace PRO scraper, which returns `SkipTraceCandidate`s. `match.ts` picks
 * the right candidate (`MatchResult`), `score.ts` grades the email
 * (`EmailScore`), and `persist.ts` writes an `OperatorContactRow`.
 */

/** One person to enrich, assembled from existing P-5 data (no scraping). */
export interface EnrichTarget {
  operatorNo: number;
  operatorName: string | null;
  /** Raw P-5 form "LAST, FIRST MIDDLE" — the stable record key. */
  officerName: string;
  firstName: string | null;
  lastName: string | null;
  /** "First Last" as sent to the scraper. */
  searchName: string;
  /** Filer phone, digits only, or null. The primary lookup + corroboration key. */
  phone: string | null;
  /** 2-letter state, never empty (TX fallback applied in SQL). */
  state: string;
  city: string | null;
  zip: number | null;
  /** normalize(last,first)+phone — dedup/cache key (a person spans operators). */
  personKey: string;
}

/** A single person returned by the scraper, normalized from its raw item. */
export interface SkipTraceCandidate {
  fullName: string | null;
  bestEmail: string | null;
  bestEmailVerified: boolean | null;
  /** All candidate emails (lowercased), if the actor returns a list. */
  emails: string[];
  bestPhone: string | null;
  phoneType: string | null;
  phoneLive: boolean | null;
  /** All associated phone numbers, digits only — used for the K1 phone check. */
  phones: string[];
  currentAddress: string | null;
  age: number | null;
  employer: string | null;
  occupation: string | null;
  /** Actor's own 0-100 confidence for this candidate. */
  matchConfidence: number | null;
  sourceCount: number | null;
  mostLikely: boolean | null;
  /** ISO date or raw string of last seen activity, if provided. */
  lastActivityDate: string | null;
  breachExposed: boolean | null;
  sources: string[];
  /** The original item, stored verbatim so we never re-pay to re-derive. */
  raw: Record<string, unknown>;
}

/** How we decided a candidate is the right person (drives the confidence score). */
export type MatchBasis =
  | "phone_namematch" // name matches AND the candidate carries our filer phone
  | "name_k1" // candidate carries our filer phone, name uncertain
  | "name_k2" // name match + address (city/zip) corroboration
  | "name_k3" // name match + employer/occupation corroboration
  | "single" // lone name match, state consistent, no other corroboration
  | "ambiguous" // multiple plausible people, no clear winner — do not email
  | "none"; // nothing usable returned

export interface MatchResult {
  basis: MatchBasis;
  candidate: SkipTraceCandidate | null;
  /** 0-100 attribution certainty (is this the right person). */
  matchConfidence: number;
}

export type EmailGrade = "verified_active" | "verified_uncertain" | "none";

export interface EmailScore {
  /** 0-100; the outbound sort key. */
  emailConfidence: number;
  emailGrade: EmailGrade;
}

/** A row of the `operator_contacts` table. */
export interface OperatorContactRow {
  operator_no: number;
  officer_name: string;
  person_key: string;
  best_email: string | null;
  email_confidence: number | null;
  email_grade: EmailGrade;
  emails: string[];
  best_phone: string | null;
  phone_type: string | null;
  phone_live: boolean | null;
  current_address: string | null;
  age: number | null;
  employer: string | null;
  occupation: string | null;
  match_basis: MatchBasis;
  match_confidence: number;
  sources: string[];
  raw: Record<string, unknown> | null;
}
