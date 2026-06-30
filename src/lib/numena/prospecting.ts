import { getProspectingClient } from "@/lib/numena/prospecting-supabase";

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
  /** Total offering amount in US dollars, if disclosed. */
  offeringAmount: number | null;
  /** Reg D exemption claimed, e.g. "506(c)", "506(b)", "504". */
  exemption: string;
  /** ISO timestamp the filing was filed with the SEC. */
  filedAt: string;
}

/** Shape of a row from the `v_firm_recent_deals` view in numena-data. */
interface FirmRecentDealRow {
  accession_no: string;
  form_type: string;
  filed_at: string;
  issuer_name: string | null;
  industry_group: string | null;
  total_offering: number | null;
  rule_506b: boolean;
  rule_506c: boolean;
  rule_504: boolean;
}

function exemptionLabel(row: FirmRecentDealRow): string {
  if (row.rule_506c) return "506(c)";
  if (row.rule_506b) return "506(b)";
  if (row.rule_504) return "504";
  return "—";
}

function mapFiling(row: FirmRecentDealRow): Filing {
  return {
    id: row.accession_no,
    issuer: row.issuer_name ?? "Unknown issuer",
    formType: row.form_type,
    industry: row.industry_group ?? "—",
    offeringAmount: row.total_offering,
    exemption: exemptionLabel(row),
    filedAt: row.filed_at,
  };
}

/** How many unique filings to show, to keep the table fast to load. */
const FILINGS_LIMIT = 1000;

/**
 * Rows per request. PostgREST caps responses at 1000 rows, so we page through
 * with `.range()`. `v_firm_recent_deals` is firm-grained — one row per
 * (recipient firm, filing) — so a single filing appears multiple times and we
 * de-dupe by accession number across pages.
 */
const PAGE_SIZE = 1000;

/**
 * Safety cap on pages fetched, so a low de-dupe ratio can't spiral into an
 * unbounded scan. ~2.3x duplication observed, so 8 pages comfortably covers
 * 1000 unique filings.
 */
const MAX_PAGES = 8;

/**
 * The most recent Form D filings, newest first, de-duplicated to one row per
 * filing. Reads directly from the prospecting project's `v_firm_recent_deals`
 * view. Returns an empty list when the prospecting Supabase project is not
 * configured.
 */
export async function getFilings(): Promise<Filing[]> {
  const sb = getProspectingClient();
  if (!sb) return [];

  const seen = new Set<string>();
  const filings: Filing[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await sb
      .from("v_firm_recent_deals")
      .select(
        "accession_no, form_type, filed_at, issuer_name, industry_group, total_offering, rule_506b, rule_506c, rule_504"
      )
      .order("filed_at", { ascending: false })
      .order("accession_no", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[numena] getFilings failed:", error.message);
      break;
    }

    const rows = (data ?? []) as FirmRecentDealRow[];
    for (const row of rows) {
      if (seen.has(row.accession_no)) continue;
      seen.add(row.accession_no);
      filings.push(mapFiling(row));
    }

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
