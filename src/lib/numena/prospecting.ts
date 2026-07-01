import { getProspectingClient } from "@/lib/numena/prospecting-supabase";
import { timezoneForState } from "@/lib/numena/timezones";

/**
 * Numena prospecting data.
 *
 * Filings are read live from the Numena prospecting Supabase project (Form D
 * filings). Investors and BDs are still placeholder data until those sources
 * are wired up.
 */

/** The prospecting categories shown on the Numena page. */
export type ProspectingCategory = "filings" | "investors" | "bds";

/** An officer / director / promoter named on a filing. */
export interface IssuerPerson {
  name: string;
  /** Roles, e.g. ["Executive Officer", "Director"]. */
  relationships: string[];
  /** "City, ST" when available. */
  location: string;
}

/**
 * Everything we hold on a single filing's issuer — assembled on demand from
 * `form_d_issuers`, `form_d_offerings`, and `form_d_related_persons` for the
 * issuer profile modal.
 */
export interface IssuerProfile {
  accessionNo: string;
  // ── Issuer (form_d_issuers, primary issuer) ──
  name: string;
  cik: string | null;
  jurisdiction: string | null;
  entityType: string | null;
  yearOfInception: number | null;
  /** Assembled "street, city, ST zip". */
  address: string | null;
  phone: string | null;
  // ── Offering (form_d_offerings) ──
  industry: string | null;
  exemption: string;
  totalOffering: number | null;
  totalSold: number | null;
  totalRemaining: number | null;
  minInvestment: number | null;
  securitiesTypes: string[];
  dateFirstSale: string | null;
  numTotalInvestors: number | null;
  numNonAccred: number | null;
  // ── People (form_d_related_persons) ──
  people: IssuerPerson[];
}

/** A single Form D filing, one row per filing event. */
export interface Filing {
  /** SEC accession number — unique per filing. */
  id: string;
  /** Filing issuer (the company that filed). */
  issuer: string;
  /** Form type, e.g. "D" or "D/A" (amendment). */
  formType: string;
  /** Industry group the issuer reported. */
  industry: string;
  /** Primary issuer location, "City, ST" when available. */
  location: string;
  /** Predominant time zone for the issuer's state, e.g. "CT" (or "—"). */
  timezone: string;
  /** Amount sold to date in US dollars, if disclosed. */
  raised: number | null;
  /** Total offering amount in US dollars, if disclosed. */
  offeringAmount: number | null;
  /** Reg D exemption claimed, e.g. "506(c)", "506(b)", "504". */
  exemption: string;
  /** ISO timestamp the filing was filed with the SEC. */
  filedAt: string;
}

/** Offering detail embedded from `form_d_offerings` (one per filing). */
interface OfferingEmbed {
  industry_group: string | null;
  total_offering: number | null;
  total_sold: number | null;
  rule_506b: boolean | null;
  rule_506c: boolean | null;
  rule_504: boolean | null;
}

/** Issuer embedded from `form_d_issuers` (one row per issuer on the filing). */
interface IssuerEmbed {
  name: string | null;
  issuer_seq: number | null;
  address_city: string | null;
  address_state: string | null;
}

/**
 * Shape of a row from `form_d_submissions` in numena-data, with the offering
 * and issuer(s) embedded via PostgREST. One row per filing — every Form D,
 * whether or not a broker-dealer / placement agent was named on it.
 */
interface FilingRow {
  accession_no: string;
  form_type: string;
  filed_at: string;
  form_d_offerings: OfferingEmbed | OfferingEmbed[] | null;
  form_d_issuers: IssuerEmbed[] | null;
}

/** Normalize a PostgREST to-one embed that may arrive as an array. */
function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function exemptionLabel(offering: OfferingEmbed | null): string {
  if (!offering) return "—";
  if (offering.rule_506c) return "506(c)";
  if (offering.rule_506b) return "506(b)";
  if (offering.rule_504) return "504";
  return "—";
}

/** The primary issuer (issuer_seq 1), falling back to the first listed. */
function primaryIssuer(issuers: IssuerEmbed[] | null): IssuerEmbed | null {
  if (!issuers || issuers.length === 0) return null;
  return issuers.find((i) => i.issuer_seq === 1) ?? issuers[0];
}

/** "City, ST" for the issuer, falling back to whichever part is present. */
function issuerLocation(issuer: IssuerEmbed | null): string {
  const city = issuer?.address_city?.trim();
  const state = issuer?.address_state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || "—";
}

function mapFiling(row: FilingRow): Filing {
  const offering = firstOrNull(row.form_d_offerings);
  const issuer = primaryIssuer(row.form_d_issuers);
  return {
    id: row.accession_no,
    issuer: issuer?.name ?? "Unknown issuer",
    formType: row.form_type,
    industry: offering?.industry_group ?? "—",
    location: issuerLocation(issuer),
    timezone: timezoneForState(issuer?.address_state),
    exemption: exemptionLabel(offering),
    raised: offering?.total_sold ?? null,
    offeringAmount: offering?.total_offering ?? null,
    filedAt: row.filed_at,
  };
}

/** How many filings to show, to keep the table fast to load. */
const FILINGS_LIMIT = 1000;

/**
 * Rows per request. PostgREST caps responses at 1000 rows, so we page through
 * with `.range()`. `form_d_submissions` is filing-grained — one row per filing
 * — so no de-duplication is needed.
 */
const PAGE_SIZE = 1000;

/** Safety cap on pages fetched, so the scan can never run unbounded. */
const MAX_PAGES = 8;

/**
 * Columns pulled per filing: the submission itself, plus its offering detail
 * and issuer(s) embedded from `form_d_offerings` / `form_d_issuers`.
 */
const FILINGS_SELECT =
  "accession_no, form_type, filed_at, " +
  "form_d_offerings(industry_group, total_offering, total_sold, rule_506b, rule_506c, rule_504), " +
  "form_d_issuers(name, issuer_seq, address_city, address_state)";

/**
 * The most recent Form D filings, newest first — one row per filing. Reads
 * directly from the prospecting project's `form_d_submissions` table, so it
 * includes every filing regardless of whether a broker-dealer / placement
 * agent was named on it. Returns an empty list when the prospecting Supabase
 * project is not configured.
 */
export async function getFilings(): Promise<Filing[]> {
  const sb = getProspectingClient();
  if (!sb) return [];

  const filings: Filing[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await sb
      .from("form_d_submissions")
      .select(FILINGS_SELECT)
      .order("filed_at", { ascending: false })
      .order("accession_no", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[numena] getFilings failed:", error.message);
      break;
    }

    const rows = (data ?? []) as unknown as FilingRow[];
    for (const row of rows) filings.push(mapFiling(row));

    // Stop once we have enough, or when the source is exhausted.
    if (filings.length >= FILINGS_LIMIT || rows.length < PAGE_SIZE) break;
  }

  return filings.slice(0, FILINGS_LIMIT);
}

/** An individual investor or LP in the prospecting pipeline. */
export interface Investor {
  id: string;
  name: string;
  /** Affiliated firm or fund. */
  firm: string;
  /** Investment focus / mandate. */
  focus: string;
  /** Indicated commitment, pre-formatted for display. */
  commitment: string;
  email: string;
  status: "Active" | "Inactive" | "Suspended";
}

/**
 * A business developer prospect — a placement agent / broker-dealer that has
 * acted as a sales-compensation recipient on Form D deals. Sourced from the
 * `v_bd_prospects` rollup (FINRA firm profile + Form D deal activity).
 */
export interface BusinessDeveloper {
  /** Resolved firm id (firm_master.firm_id). */
  id: string;
  name: string;
  /** CRD number, when the firm is FINRA-registered. */
  crd: string | null;
  /** Main office "City, ST" (or country), for display. */
  location: string;
  /** Form D deals placed in the trailing 24 months. */
  deals24mo: number;
  /** Of those, deals claiming the 506(c) exemption. */
  deals506c24mo: number;
  /** Sum of offering sizes on those deals, in USD (a deal-flow proxy). */
  capitalPlaced24mo: number | null;
  /** Deals placed in the trailing 90 days — the recent-activity signal. */
  deals90d: number;
  /** ISO date of the firm's most recent deal, if any. */
  lastDealAt: string | null;
}

/** Shape of a row from the `v_bd_prospects` view in numena-data. */
interface BdProspectRow {
  firm_id: string;
  name: string | null;
  crd: string | null;
  main_office_city: string | null;
  main_office_state: string | null;
  main_office_country: string | null;
  deals_24mo: number | null;
  deals_506c_24mo: number | null;
  capital_placed_24mo: number | null;
  deals_90d: number | null;
  last_deal_at: string | null;
}

/** "City, ST", falling back to country, then an em-dash-free placeholder. */
function bdLocation(row: BdProspectRow): string {
  const city = row.main_office_city?.trim();
  const state = row.main_office_state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || row.main_office_country?.trim() || "—";
}

function mapBd(row: BdProspectRow): BusinessDeveloper {
  return {
    id: row.firm_id,
    name: row.name ?? "Unknown firm",
    crd: row.crd,
    location: bdLocation(row),
    deals24mo: row.deals_24mo ?? 0,
    deals506c24mo: row.deals_506c_24mo ?? 0,
    capitalPlaced24mo: row.capital_placed_24mo,
    deals90d: row.deals_90d ?? 0,
    lastDealAt: row.last_deal_at,
  };
}

/**
 * How many BD prospects to load. The view holds ~1,900 placement-agent firms;
 * we surface the most recently active to keep the (unvirtualized) table fast.
 */
const BDS_LIMIT = 500;

/** A single deal a BD firm was named on, for the BD profile's recent-deals list. */
export interface BdRecentDeal {
  accessionNo: string;
  issuer: string;
  filedAt: string;
  offeringAmount: number | null;
  exemption: string;
}

/**
 * Everything we hold on a BD prospect — the full `v_bd_prospects` row plus the
 * firm's most recent deals, assembled on demand for the BD profile modal.
 */
export interface BdProfile {
  firmId: string;
  name: string;
  crd: string | null;
  segment: string | null;
  /** FINRA broker-dealer registration scope, e.g. "ACTIVE". */
  bdScope: string | null;
  /** FINRA investment-adviser registration scope. */
  iaScope: string | null;
  disclosures: number | null;
  branches: number | null;
  /** Main office "City, ST" (or country). */
  location: string;
  /** When the FINRA profile was last fetched (ISO). */
  finraFetchedAt: string | null;
  deals24mo: number;
  deals506c24mo: number;
  deals90d: number;
  capitalPlaced24mo: number | null;
  capitalPlaced90d: number | null;
  share506cPct: number | null;
  momentumPct: number | null;
  lastDealAt: string | null;
  last506cDealAt: string | null;
  industries: string[];
  recentDeals: BdRecentDeal[];
}

const INVESTORS: Investor[] = [
  {
    id: "i-1",
    name: "Harold Kessler",
    firm: "Kessler Trust",
    focus: "Royalty Interests",
    commitment: "$15M",
    email: "hkessler@kesslertrust.com",
    status: "Active",
  },
  {
    id: "i-2",
    name: "Yvonne Castillo",
    firm: "Permian Crest Capital",
    focus: "Working Interest",
    commitment: "$40M",
    email: "ycastillo@permiancrest.com",
    status: "Active",
  },
  {
    id: "i-3",
    name: "Devon Pierce",
    firm: "Independent",
    focus: "Mineral Acquisition",
    commitment: "$6M",
    email: "devon.pierce@gmail.com",
    status: "Active",
  },
  {
    id: "i-4",
    name: "Sophia Lambert",
    firm: "Sabine Family Office",
    focus: "Mezzanine Debt",
    commitment: "$25M",
    email: "slambert@sabinefo.com",
    status: "Inactive",
  },
  {
    id: "i-5",
    name: "Theodore Nguyen",
    firm: "Gulf Meridian Advisors",
    focus: "Drilling Partnerships",
    commitment: "$52M",
    email: "tnguyen@gulfmeridian.com",
    status: "Active",
  },
  {
    id: "i-6",
    name: "Margaret O'Dell",
    firm: "O'Dell Holdings",
    focus: "Royalty Interests",
    commitment: "$9M",
    email: "modell@odellholdings.com",
    status: "Suspended",
  },
];

export async function getInvestors(): Promise<Investor[]> {
  return INVESTORS;
}

/**
 * Business developer prospects — placement agents / broker-dealers ranked by
 * recent deal activity (90-day, then 24-month). Reads from the prospecting
 * project's `v_bd_prospects` view. Returns an empty list when the prospecting
 * Supabase project is not configured.
 */
export async function getBusinessDevelopers(): Promise<BusinessDeveloper[]> {
  const sb = getProspectingClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("v_bd_prospects")
    .select(
      "firm_id, name, crd, main_office_city, main_office_state, main_office_country, deals_24mo, deals_506c_24mo, capital_placed_24mo, deals_90d, last_deal_at"
    )
    .order("deals_90d", { ascending: false, nullsFirst: false })
    .order("deals_24mo", { ascending: false, nullsFirst: false })
    .limit(BDS_LIMIT);

  if (error) {
    console.error("[numena] getBusinessDevelopers failed:", error.message);
    return [];
  }

  return ((data ?? []) as BdProspectRow[]).map(mapBd);
}
