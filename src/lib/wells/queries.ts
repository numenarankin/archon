// Client-side Supabase queries for the wells map. The map dots come from static
// vector tiles; these fetch the rich detail for a clicked well (well facts +
// operator P-5 profile + officers) and back the operator search filter.
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface WellRow {
  api_number: number;
  county_code: number | null;
  admin_district: number | null;
  oil_gas: string | null;
  oil_gas_label: string | null;
  water_land: string | null;
  is_plugged: boolean | null;
  has_fresh_water: boolean | null;
  total_depth: number | null;
  n_formations: number | null;
  deepest_formation_depth: number | null;
  n_completions: number | null;
  latitude: number | null;
  longitude: number | null;
  plugged_d: string | null;
  w3_filed_d: string | null;
}

export interface OperatorDetailRow {
  api_number: number;
  operator_number: number | null;
  operator_source: string | null;
  plugging_operator_name: string | null;
  operator_name: string | null;
  p5_status: string | null;
  addr_line1: string | null;
  addr_line2: string | null;
  city: string | null;
  state: string | null;
  zip: number | null;
  last_p5_date: number | null;
  operator_display_name: string | null;
  officer_count: number | null;
}

export interface OfficerRow {
  officer_name: string | null;
  officer_title: string | null;
  officer_city: string | null;
  officer_state: string | null;
}

export interface WellDetail {
  well: WellRow | null;
  operator: OperatorDetailRow | null;
  officers: OfficerRow[];
}

/** Full payload for a clicked well: facts + operator profile + officers. */
export async function getWellDetail(api: number): Promise<WellDetail> {
  const sb = getSupabaseBrowser();
  const [wellRes, opRes] = await Promise.all([
    sb.from("wells").select("*").eq("api_number", api).maybeSingle(),
    sb.from("well_operator_detail").select("*").eq("api_number", api).maybeSingle(),
  ]);

  const operator = (opRes.data as OperatorDetailRow | null) ?? null;
  let officers: OfficerRow[] = [];
  if (operator?.operator_number) {
    const { data } = await sb
      .from("operator_officers")
      .select("officer_name,officer_title,officer_city,officer_state")
      .eq("operator_number", operator.operator_number)
      .limit(100);
    officers = (data as OfficerRow[] | null) ?? [];
  }

  return { well: (wellRes.data as WellRow | null) ?? null, operator, officers };
}

/** One operator placed at its mailing-ZIP centroid (from public/operators.json). */
export interface OperatorPoint {
  n: number; // operator_number
  nm: string; // name
  a: string; // address line 1
  c: string; // city
  s: string; // state
  z: number; // zip
  lng: number;
  lat: number;
  w: number; // well count (all wells)
  wa?: number; // active (non-plugged) well count; absent in older data files
}

let operatorsCache: OperatorPoint[] | null = null;

/** Load + cache the static operator points (placed by ZIP) for operator mode. */
export async function loadOperatorPoints(): Promise<OperatorPoint[]> {
  if (operatorsCache) return operatorsCache;
  const res = await fetch("/operators.json");
  if (!res.ok) throw new Error(`operators.json ${res.status}`);
  operatorsCache = (await res.json()) as OperatorPoint[];
  return operatorsCache;
}

export interface FocusWell {
  api: number;
  lng: number;
  lat: number;
  og: string | null;
}

interface FocusOpts {
  operatorNumber: number | null;
  countyCode: number | null;
  oilGas: "O" | "G" | null;
  plugged: boolean | null;
  district: number | null;
}

const FOCUS_CAP = 30000;
const PAGE = 1000;
type GeoRow = { api_number: number; longitude: number; latitude: number; oil_gas: string | null };

/**
 * Geocoded wells matching a narrow search (operator and/or county, plus the
 * category filters) for the map's "focus" layer — shows ONLY these wells.
 * Capped at 30k; paginated because PostgREST returns <=1000 rows per request.
 */
export async function getFocusWells(
  opts: FocusOpts,
): Promise<{ wells: FocusWell[]; capped: boolean }> {
  const sb = getSupabaseBrowser();
  const toWell = (r: GeoRow): FocusWell => ({
    api: r.api_number,
    lng: r.longitude,
    lat: r.latitude,
    og: r.oil_gas,
  });

  // Restrict to one operator's wells first (resolve their API numbers).
  let apiSet: number[] | null = null;
  if (opts.operatorNumber !== null) {
    apiSet = [];
    for (let from = 0; from < FOCUS_CAP; from += PAGE) {
      const { data } = await sb
        .from("well_operator")
        .select("api_number")
        .eq("operator_number", opts.operatorNumber)
        .range(from, from + PAGE - 1);
      const rows = (data as { api_number: number }[] | null) ?? [];
      apiSet.push(...rows.map((r) => r.api_number));
      if (rows.length < PAGE) break;
    }
    if (apiSet.length === 0) return { wells: [], capped: false };
  }

  const select = "api_number,longitude,latitude,oil_gas";
  const attrs = <T>(q: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let b = q as any;
    if (opts.oilGas) b = b.eq("oil_gas", opts.oilGas);
    if (opts.plugged !== null) b = b.eq("is_plugged", opts.plugged);
    if (opts.district !== null) b = b.eq("admin_district", opts.district);
    if (opts.countyCode !== null) b = b.eq("county_code", opts.countyCode);
    return b as T;
  };

  const wells: FocusWell[] = [];
  if (apiSet) {
    // Coordinates for the operator's wells, chunked to keep the URL short.
    for (let i = 0; i < apiSet.length; i += 500) {
      const chunk = apiSet.slice(i, i + 500);
      const { data } = await attrs(
        sb.from("wells").select(select).in("api_number", chunk).not("latitude", "is", null),
      );
      for (const r of (data as GeoRow[] | null) ?? []) wells.push(toWell(r));
    }
    return { wells, capped: apiSet.length >= FOCUS_CAP };
  }

  // County-only focus (paginated).
  for (let from = 0; from < FOCUS_CAP; from += PAGE) {
    const { data } = await attrs(
      sb.from("wells").select(select).not("latitude", "is", null).range(from, from + PAGE - 1),
    );
    const rows = (data as GeoRow[] | null) ?? [];
    for (const r of rows) wells.push(toWell(r));
    if (rows.length < PAGE) break;
  }
  return { wells, capped: wells.length >= FOCUS_CAP };
}

export interface OperatorMatch {
  operator_number: number;
  operator_name: string | null;
}

export interface OperatorFull {
  operator_number: number;
  operator_name: string | null;
  p5_status: string | null;
  addr_line1: string | null;
  addr_line2: string | null;
  city: string | null;
  state: string | null;
  zip: number | null;
  zip_suffix: number | null;
  phone: number | null;
  last_p5_date: number | null;
  oil_gatherer: string | null;
  gas_gatherer: string | null;
}

export interface OperatorWellRow {
  api_number: number;
  admin_district: number | null;
  county_code: number | null;
  oil_gas_label: string | null;
  is_plugged: boolean | null;
  total_depth: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OperatorDetail {
  operator: OperatorFull | null;
  officers: OfficerRow[];
  wellCount: number;
  wells: OperatorWellRow[];
}

/** Full operator profile + officers + their wells (capped, with the true count). */
export async function getOperatorDetail(
  operatorNumber: number,
  limit = 500,
): Promise<OperatorDetail> {
  const sb = getSupabaseBrowser();
  const [opRes, offRes, linkRes] = await Promise.all([
    sb.from("operators").select("*").eq("operator_number", operatorNumber).maybeSingle(),
    sb
      .from("operator_officers")
      .select("officer_name,officer_title,officer_city,officer_state")
      .eq("operator_number", operatorNumber)
      .limit(100),
    sb
      .from("well_operator")
      .select("api_number", { count: "exact" })
      .eq("operator_number", operatorNumber)
      .limit(limit),
  ]);

  const apis = ((linkRes.data as { api_number: number }[] | null) ?? []).map(
    (r) => r.api_number,
  );
  let wells: OperatorWellRow[] = [];
  if (apis.length) {
    const { data } = await sb
      .from("wells")
      .select(
        "api_number,admin_district,county_code,oil_gas_label,is_plugged,total_depth,latitude,longitude",
      )
      .in("api_number", apis);
    wells = ((data as OperatorWellRow[] | null) ?? []).sort(
      (a, b) => a.api_number - b.api_number,
    );
  }

  return {
    operator: (opRes.data as OperatorFull | null) ?? null,
    officers: (offRes.data as OfficerRow[] | null) ?? [],
    wellCount: linkRes.count ?? apis.length,
    wells,
  };
}

export interface OperatorLast12 {
  oil_last12: number;
  gas_last12: number;
}

/** Last-12mo oil/gas per operator for a set, keyed by operator number. */
export async function getOperatorsLast12(
  operatorNumbers: number[],
): Promise<Map<number, { oil: number; gas: number }>> {
  const m = new Map<number, { oil: number; gas: number }>();
  if (operatorNumbers.length === 0) return m;
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("operators_last12", {
    p_operators: operatorNumbers,
  });
  if (error) throw new Error(`operators_last12: ${error.message}`);
  for (const r of (data as
    | { operator_no: number; oil_last12: number; gas_last12: number }[]
    | null) ?? []) {
    m.set(r.operator_no, { oil: r.oil_last12 ?? 0, gas: r.gas_last12 ?? 0 });
  }
  return m;
}

/** P-5 master fields for a set of operators (for the cluster CSV export). */
export interface OperatorP5 {
  operator_number: number;
  p5_status: string | null;
  last_p5_date: number | null;
  phone: number | null;
  addr_line1: string | null;
  addr_line2: string | null;
  city: string | null;
  state: string | null;
  zip: number | null;
  zip_suffix: number | null;
  oil_gatherer: string | null;
  gas_gatherer: string | null;
}

/**
 * P-5 master record for a set of operators, keyed by operator number. Chunked so
 * the `in(...)` list stays well under PostgREST's URL/row limits.
 */
export async function getOperatorsP5(
  operatorNumbers: number[],
): Promise<Map<number, OperatorP5>> {
  const m = new Map<number, OperatorP5>();
  if (operatorNumbers.length === 0) return m;
  const sb = getSupabaseBrowser();
  const select =
    "operator_number,p5_status,last_p5_date,phone,addr_line1,addr_line2,city,state,zip,zip_suffix,oil_gatherer,gas_gatherer";
  for (let i = 0; i < operatorNumbers.length; i += 300) {
    const chunk = operatorNumbers.slice(i, i + 300);
    const { data, error } = await sb
      .from("operators")
      .select(select)
      .in("operator_number", chunk);
    if (error) throw new Error(`getOperatorsP5: ${error.message}`);
    for (const r of (data as OperatorP5[] | null) ?? []) {
      m.set(r.operator_number, r);
    }
  }
  return m;
}

/** An operator's last-12-month oil + gas production totals. */
export async function getOperatorLast12(
  operatorNumber: number,
): Promise<OperatorLast12> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("operator_last12", {
    p_operator: operatorNumber,
  });
  if (error) throw new Error(`operator_last12: ${error.message}`);
  const row = (data as OperatorLast12[] | null)?.[0];
  return { oil_last12: row?.oil_last12 ?? 0, gas_last12: row?.gas_last12 ?? 0 };
}

export interface OperatorLease {
  oil_gas_code: string;
  district_no: number;
  lease_no: number;
  lease_name: string | null;
  well_count: number;
  oil_last12: number | null;
  gas_last12: number | null;
  last_cycle: number | null;
}

/** Leases this operator currently produces, with last-12mo oil/gas + well count. */
export async function getOperatorLeases(
  operatorNumber: number,
): Promise<OperatorLease[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("operator_leases", {
    p_operator: operatorNumber,
  });
  if (error) throw new Error(`operator_leases: ${error.message}`);
  return (data as OperatorLease[] | null) ?? [];
}

export interface PrincipalAffiliation {
  operator_number: number;
  operator_name: string | null;
  p5_status: string | null;
  officer_title: string | null;
  officer_city: string | null;
  officer_state: string | null;
}

export interface PrincipalDetail {
  name: string;
  affiliations: PrincipalAffiliation[];
}

/** Everything on file for a principal/officer: every operator they're listed on. */
export async function getPrincipalDetail(name: string): Promise<PrincipalDetail> {
  const sb = getSupabaseBrowser();
  const { data: officers } = await sb
    .from("operator_officers")
    .select("operator_number,officer_title,officer_city,officer_state")
    .eq("officer_name", name)
    .limit(200);
  const rows =
    (officers as Pick<
      PrincipalAffiliation,
      "operator_number" | "officer_title" | "officer_city" | "officer_state"
    >[] | null) ?? [];

  const opNums = [...new Set(rows.map((r) => r.operator_number))];
  const ops = new Map<number, { operator_name: string | null; p5_status: string | null }>();
  if (opNums.length) {
    const { data } = await sb
      .from("operators")
      .select("operator_number,operator_name,p5_status")
      .in("operator_number", opNums);
    for (const o of (data as { operator_number: number; operator_name: string | null; p5_status: string | null }[] | null) ?? []) {
      ops.set(o.operator_number, { operator_name: o.operator_name, p5_status: o.p5_status });
    }
  }

  // One row per operator; a person can hold multiple titles at one operator.
  const byOp = new Map<number, PrincipalAffiliation>();
  for (const r of rows) {
    const existing = byOp.get(r.operator_number);
    if (existing) {
      const titles = [existing.officer_title, r.officer_title].filter(Boolean);
      existing.officer_title = titles.length ? titles.join(" / ") : null;
    } else {
      byOp.set(r.operator_number, {
        operator_number: r.operator_number,
        operator_name: ops.get(r.operator_number)?.operator_name ?? null,
        p5_status: ops.get(r.operator_number)?.p5_status ?? null,
        officer_title: r.officer_title,
        officer_city: r.officer_city,
        officer_state: r.officer_state,
      });
    }
  }
  const affiliations = [...byOp.values()].sort((a, b) =>
    (a.operator_name ?? "").localeCompare(b.operator_name ?? ""),
  );

  return { name, affiliations };
}

/** Resolve an operator-name search to numbers for the operator-highlight filter. */
export async function searchOperators(query: string): Promise<OperatorMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sb = getSupabaseBrowser();
  const { data } = await sb
    .from("operators")
    .select("operator_number,operator_name")
    .ilike("operator_name", `%${q}%`)
    .order("operator_name")
    .limit(10);
  return (data as OperatorMatch[] | null) ?? [];
}
