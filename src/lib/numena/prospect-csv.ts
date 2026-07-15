import type { SupabaseClient } from "@supabase/supabase-js";
import { timezoneForState } from "@/lib/numena/timezones";

/**
 * Shared, pure building blocks for the Numena prospecting CSV export and its
 * enrichment. Deliberately NOT a "use server" module (those may only export
 * async server actions) so both the export action and the enrichment pipeline
 * can import the same headers, helpers, row shape, and serializer.
 *
 * One row is emitted **per related person** on each Form D filing in range,
 * oldest filing first. Six fields Archon owns are populated up front (Filing
 * date, Listed Issuer, Location, Time Zone, Company Phone, Prospect Name); the
 * rest are blank and filled in — Company Name / Website / LinkedIn — only by
 * enrichment, which never removes a row.
 */

/** The base column headers, in the exact order of the enrichment sheet. */
export const CSV_HEADERS = [
  "Filing date",
  "Listed Issuer",
  "Company Name",
  "Location",
  "Time Zone",
  "Company Phone",
  "Company Website",
  "Company LinkedIn",
  "Prospect Name",
  "Prospect Title",
  "Prospect LinkedIn",
  "Prospect Phone",
  "Prospect Email",
] as const;

/** Extra trailing column, present only on the enriched CSV. */
export const SOURCES_HEADER = "Sources";

/** Rows per PostgREST request. PostgREST caps responses at 1000. */
const PAGE_SIZE = 1000;

/**
 * Safety cap on filings scanned (30k). A wide user range can span far more; we
 * stop here and report truncation rather than run unbounded.
 */
const MAX_FILINGS = 30_000;

/** Offering embed — for exemption / industry, mirroring the Filings table. */
interface OfferingEmbed {
  industry_group: string | null;
  rule_506b: boolean | null;
  rule_506c: boolean | null;
  rule_504: boolean | null;
}

/** Primary issuer embed (issuer_seq 1), for name / location / phone. */
interface IssuerEmbed {
  name: string | null;
  issuer_seq: number | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
}

/** Related-person embed — the prospect name, ordered by person_seq. */
interface PersonEmbed {
  name: string | null;
  person_seq: number | null;
}

/** One filing with its offering, issuer(s) and related person(s) embedded. */
interface ExportRow {
  accession_no: string;
  filed_at: string;
  form_d_offerings: OfferingEmbed | OfferingEmbed[] | null;
  form_d_issuers: IssuerEmbed[] | null;
  form_d_related_persons: PersonEmbed[] | null;
}

const EXPORT_SELECT =
  "accession_no, filed_at, " +
  "form_d_offerings(industry_group, rule_506b, rule_506c, rule_504), " +
  "form_d_issuers(name, issuer_seq, address_city, address_state, phone), " +
  "form_d_related_persons(name, person_seq)";

/**
 * On-screen filters the export should honor, mirroring the Filings table.
 * "all" / undefined means no narrowing on that dimension.
 */
export interface ExportFilters {
  /** Exact exemption label, e.g. "506(c)", or "all"/undefined for any. */
  exemption?: string;
  /** Exact industry label, or "all"/undefined for any. */
  industry?: string;
}

/**
 * One output row (one person). The six populated-at-source fields are set by
 * {@link fetchExportData}; `companyName` / `companyWebsite` / `companyLinkedIn`
 * / `sources` start blank and are filled by enrichment. `issuerKey` groups rows
 * that share a Listed Issuer.
 */
export interface BaseRow {
  filingDate: string;
  listedIssuer: string;
  companyName: string;
  location: string;
  timeZone: string;
  companyPhone: string;
  companyWebsite: string;
  companyLinkedIn: string;
  prospectName: string;
  prospectTitle: string;
  prospectLinkedIn: string;
  prospectPhone: string;
  prospectEmail: string;
  sources: string;
  issuerKey: string;
}

/** All rows belonging to one Listed Issuer, plus the signals for bucketing. */
export interface IssuerGroup {
  /** Normalized issuer key (grouping id). */
  key: string;
  /** Verbatim Listed Issuer name for display / self-copy. */
  listedIssuer: string;
  location: string;
  phone: string;
  /** Every associated Prospect Name across this issuer's rows (cleaned). */
  persons: string[];
  /** Indexes into the rows array that belong to this issuer. */
  rowIndexes: number[];
}

/** Result of loading + shaping the export rows. */
export interface ExportData {
  rows: BaseRow[];
  issuers: IssuerGroup[];
  filings: number;
  truncated: boolean;
}

/** Normalize a PostgREST to-one embed that may arrive as an array. */
function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Exemption label, matching the Filings table's precedence
 * (506(c) > 506(b) > 504) so the export honors the on-screen exemption filter.
 */
function exemptionLabel(offering: OfferingEmbed | null): string {
  if (!offering) return "—";
  if (offering.rule_506c) return "506(c)";
  if (offering.rule_506b) return "506(b)";
  if (offering.rule_504) return "504";
  return "—";
}

/** Industry label, matching the Filings table (`industry_group ?? "—"`). */
function industryLabel(offering: OfferingEmbed | null): string {
  return offering?.industry_group ?? "—";
}

/** The primary issuer (issuer_seq 1), falling back to the first listed. */
function primaryIssuer(issuers: IssuerEmbed[] | null): IssuerEmbed | null {
  if (!issuers || issuers.length === 0) return null;
  return issuers.find((i) => i.issuer_seq === 1) ?? issuers[0];
}

/** "City, ST" → "City" → "ST" → "" (blank, never a dash, for the sheet). */
function issuerLocation(issuer: IssuerEmbed | null): string {
  const city = issuer?.address_city?.trim();
  const state = issuer?.address_state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || "";
}

/** Time-zone code for the issuer's state, blanked when unknown. */
function issuerTimezone(issuer: IssuerEmbed | null): string {
  const tz = timezoneForState(issuer?.address_state);
  return tz === "—" ? "" : tz;
}

/** RFC-4180 field escaping: quote when the value has a comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvLine(fields: string[]): string {
  return fields.map(csvField).join(",");
}

/**
 * Clean a related-person name: strip leading non-alphanumeric punctuation
 * (e.g. a stray "- " prefix on entity promoters) and surrounding whitespace.
 */
export function cleanProspectName(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

/** Normalize an issuer name into a stable grouping key. */
export function issuerKeyOf(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

/** yyyy-mm-dd guard so a bad value can never reach the query. */
export function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** The yyyy-mm-dd date one day after `iso`, for an exclusive upper bound. */
export function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Load Form D filings in `[dateFrom, dateTo]` (inclusive, yyyy-mm-dd), applying
 * the exemption/industry filters, and shape them into one {@link BaseRow} per
 * related person (oldest filing first) plus per-issuer groups for enrichment.
 */
export async function fetchExportData(
  sb: SupabaseClient,
  dateFrom: string,
  dateTo: string,
  filters: ExportFilters = {}
): Promise<ExportData> {
  const exemption =
    filters.exemption && filters.exemption !== "all" ? filters.exemption : null;
  const industry =
    filters.industry && filters.industry !== "all" ? filters.industry : null;

  const upperExclusive = dayAfter(dateTo);
  const rows: BaseRow[] = [];
  const groups = new Map<string, IssuerGroup>();
  let filings = 0;
  let truncated = false;

  for (let from = 0; from < MAX_FILINGS; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from("form_d_submissions")
      .select(EXPORT_SELECT)
      .gte("filed_at", dateFrom)
      .lt("filed_at", upperExclusive)
      .order("filed_at", { ascending: true })
      .order("accession_no", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as unknown as ExportRow[];
    for (const filing of page) {
      const offering = firstOrNull(filing.form_d_offerings);
      if (exemption && exemptionLabel(offering) !== exemption) continue;
      if (industry && industryLabel(offering) !== industry) continue;

      const issuer = primaryIssuer(filing.form_d_issuers);
      const people = [...(filing.form_d_related_persons ?? [])].sort(
        (a, b) => (a.person_seq ?? 0) - (b.person_seq ?? 0)
      );
      if (people.length === 0) continue;

      const listedIssuer = issuer?.name ?? "";
      const location = issuerLocation(issuer);
      const timeZone = issuerTimezone(issuer);
      const phone = issuer?.phone?.trim() ?? "";
      const key = issuerKeyOf(listedIssuer);

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          listedIssuer,
          location,
          phone,
          persons: [],
          rowIndexes: [],
        };
        groups.set(key, group);
      }

      let addedForFiling = false;
      for (const person of people) {
        const name = cleanProspectName(person.name ?? "");
        if (!name) continue;
        addedForFiling = true;
        const idx = rows.length;
        rows.push({
          filingDate: filing.filed_at.slice(0, 10),
          listedIssuer,
          companyName: "",
          location,
          timeZone,
          companyPhone: phone,
          companyWebsite: "",
          companyLinkedIn: "",
          prospectName: name,
          prospectTitle: "",
          prospectLinkedIn: "",
          prospectPhone: "",
          prospectEmail: "",
          sources: "",
          issuerKey: key,
        });
        group.rowIndexes.push(idx);
        if (!group.persons.includes(name)) group.persons.push(name);
      }
      if (addedForFiling) filings += 1;
    }

    if (page.length < PAGE_SIZE) break; // source exhausted
    if (from + PAGE_SIZE >= MAX_FILINGS) truncated = true;
  }

  return { rows, issuers: [...groups.values()], filings, truncated };
}

/** One BaseRow → its ordered CSV fields (13, plus Sources when `sources`). */
function rowFields(row: BaseRow, sources: boolean): string[] {
  const base = [
    row.filingDate,
    row.listedIssuer,
    row.companyName,
    row.location,
    row.timeZone,
    row.companyPhone,
    row.companyWebsite,
    row.companyLinkedIn,
    row.prospectName,
    row.prospectTitle,
    row.prospectLinkedIn,
    row.prospectPhone,
    row.prospectEmail,
  ];
  return sources ? [...base, row.sources] : base;
}

/**
 * Serialize rows to CSV text (CRLF-terminated). Pass `sources: true` for the
 * enriched CSV, which appends the trailing Sources column.
 */
export function rowsToCsv(
  rows: BaseRow[],
  { sources = false }: { sources?: boolean } = {}
): string {
  const header = sources ? [...CSV_HEADERS, SOURCES_HEADER] : [...CSV_HEADERS];
  const lines = [csvLine(header)];
  for (const row of rows) lines.push(csvLine(rowFields(row, sources)));
  return lines.join("\r\n") + "\r\n";
}
