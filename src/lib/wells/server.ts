// Server-side queries over the RRC well/operator data, used by the Archon
// tools so the assistant can answer questions about the map data. Runs through
// the request-scoped Supabase client (authenticated user, RLS applies).
import { getSupabaseServer } from "@/lib/supabase/server";
import { COUNTY_NAMES } from "./counties";

const NAME_TO_CODE = new Map(
  Object.entries(COUNTY_NAMES).map(([code, name]) => [name.toLowerCase(), Number(code)]),
);

/** Resolve a Texas county name (exact or close) to its RRC county code. */
export function countyCode(name: string): number | null {
  const q = name.trim().toLowerCase().replace(/\s+county$/, "");
  return NAME_TO_CODE.get(q) ?? null;
}

/** Full detail for one well: facts + operator P-5 profile + officers. */
export async function lookupWell(apiNumber: number) {
  const sb = await getSupabaseServer();
  const [wellRes, opRes] = await Promise.all([
    sb.from("wells").select("*").eq("api_number", apiNumber).maybeSingle(),
    sb.from("well_operator_detail").select("*").eq("api_number", apiNumber).maybeSingle(),
  ]);
  const operator = opRes.data;
  let officers: unknown[] = [];
  if (operator?.operator_number) {
    const { data } = await sb
      .from("operator_officers")
      .select("officer_name,officer_title,officer_city,officer_state")
      .eq("operator_number", operator.operator_number)
      .limit(50);
    officers = data ?? [];
  }
  return { well: wellRes.data, operator, officers };
}

export interface WellCountFilters {
  oil_gas?: "oil" | "gas";
  plugged?: boolean;
  district?: number;
  county?: string;
}

/** Count wells matching filters, with a few example API numbers. */
export async function countWells(f: WellCountFilters) {
  const sb = await getSupabaseServer();
  let q = sb.from("wells").select("api_number", { count: "exact" });
  if (f.oil_gas) q = q.eq("oil_gas", f.oil_gas === "oil" ? "O" : "G");
  if (f.plugged !== undefined) q = q.eq("is_plugged", f.plugged);
  if (f.district !== undefined) q = q.eq("admin_district", f.district);
  const resolved = f.county ? countyCode(f.county) : null;
  if (f.county && resolved === null) {
    return { count: 0, note: `Unknown county "${f.county}".`, sample: [] };
  }
  if (resolved !== null) q = q.eq("county_code", resolved);
  const { data, count } = await q.limit(8);
  return { count: count ?? 0, sample: (data ?? []).map((r) => r.api_number) };
}

/** Operator P-5 profile + officers + how many wells they operate. */
export async function lookupOperator(args: { name?: string; operator_number?: number }) {
  const sb = await getSupabaseServer();
  let opNumber = args.operator_number ?? null;

  if (opNumber === null && args.name) {
    const { data } = await sb
      .from("operators")
      .select("operator_number,operator_name,p5_status,city,state")
      .ilike("operator_name", `%${args.name}%`)
      .order("operator_name")
      .limit(10);
    const matches = data ?? [];
    if (matches.length !== 1) return { matches };
    opNumber = matches[0].operator_number;
  }
  if (opNumber === null) return { matches: [] };

  const [opRes, offRes, countRes, sampleRes] = await Promise.all([
    sb.from("operators").select("*").eq("operator_number", opNumber).maybeSingle(),
    sb
      .from("operator_officers")
      .select("officer_name,officer_title,officer_city,officer_state")
      .eq("operator_number", opNumber)
      .limit(50),
    sb
      .from("well_operator")
      .select("api_number", { count: "exact", head: true })
      .eq("operator_number", opNumber),
    sb.from("well_operator").select("api_number").eq("operator_number", opNumber).limit(8),
  ]);
  return {
    operator: opRes.data,
    officers: offRes.data ?? [],
    wells_operated: countRes.count ?? 0,
    sample_wells: (sampleRes.data ?? []).map((r) => r.api_number),
  };
}
