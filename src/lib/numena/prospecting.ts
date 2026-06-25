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

/** A business development contact / referral source. */
export interface BusinessDeveloper {
  id: string;
  name: string;
  company: string;
  /** Coverage region. */
  region: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive" | "Suspended";
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

const BDS: BusinessDeveloper[] = [
  {
    id: "b-1",
    name: "Grant Holloway",
    company: "Frontier Energy Partners",
    region: "Permian Basin",
    phone: "(432) 555-0148",
    email: "gholloway@frontierep.com",
    status: "Active",
  },
  {
    id: "b-2",
    name: "Renee Salazar",
    company: "Crossroads Capital Group",
    region: "Mid-Continent",
    phone: "(405) 555-0192",
    email: "rsalazar@crossroadscg.com",
    status: "Active",
  },
  {
    id: "b-3",
    name: "Wesley Park",
    company: "Lone Star Advisory",
    region: "Eagle Ford",
    phone: "(210) 555-0173",
    email: "wpark@lonestaradvisory.com",
    status: "Active",
  },
  {
    id: "b-4",
    name: "Bianca Reyes",
    company: "Tidewater Securities",
    region: "Gulf Coast",
    phone: "(504) 555-0119",
    email: "breyes@tidewatersec.com",
    status: "Inactive",
  },
  {
    id: "b-5",
    name: "Nathan Briggs",
    company: "Summit Resource Brokers",
    region: "Rockies",
    phone: "(303) 555-0167",
    email: "nbriggs@summitrb.com",
    status: "Active",
  },
];

export async function getInvestors(): Promise<Investor[]> {
  return INVESTORS;
}

export async function getBusinessDevelopers(): Promise<BusinessDeveloper[]> {
  return BDS;
}
