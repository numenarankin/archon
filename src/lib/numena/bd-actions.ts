"use server";

import { getProspectingClient } from "@/lib/numena/prospecting-supabase";
import { requirePermission } from "@/lib/auth/permissions";
import type { BdProfile, BdRecentDeal } from "@/lib/numena/prospecting";

interface BdRow {
  firm_id: string;
  name: string | null;
  crd: string | null;
  segment: string | null;
  bd_scope: string | null;
  ia_scope: string | null;
  bd_disclosure_count: number | null;
  branches_count: number | null;
  main_office_city: string | null;
  main_office_state: string | null;
  main_office_country: string | null;
  finra_fetched_at: string | null;
  deals_24mo: number | string | null;
  deals_506c_24mo: number | string | null;
  deals_90d: number | string | null;
  capital_placed_24mo: number | string | null;
  capital_placed_90d: number | string | null;
  share_506c_pct: number | string | null;
  momentum_pct: number | string | null;
  last_deal_at: string | null;
  last_506c_deal_at: string | null;
  industries: string[] | null;
}

interface DealRow {
  accession_no: string;
  issuer_name: string | null;
  filed_at: string;
  total_offering: number | string | null;
  rule_506b: boolean;
  rule_506c: boolean;
  rule_504: boolean;
}

/** Coerce PostgREST numerics (which can arrive as strings) to a number. */
function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function location(row: BdRow): string {
  const city = row.main_office_city?.trim();
  const state = row.main_office_state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || row.main_office_country?.trim() || "—";
}

function exemptionLabel(d: DealRow): string {
  if (d.rule_506c) return "506(c)";
  if (d.rule_506b) return "506(b)";
  if (d.rule_504) return "504";
  return "—";
}

/** How many recent deals to show in the profile. */
const RECENT_DEALS_LIMIT = 12;

/**
 * Fetch the full BD prospect profile for a firm, on demand: the `v_bd_prospects`
 * row plus the firm's most recent deals (de-duped by filing). Returns null when
 * the prospecting project is unconfigured or the firm is unknown.
 */
export async function getBdProfile(firmId: string): Promise<BdProfile | null> {
  await requirePermission("view_prospects");

  const sb = getProspectingClient();
  if (!sb) return null;

  const [bdRes, dealsRes] = await Promise.all([
    sb
      .from("v_bd_prospects")
      .select(
        "firm_id, name, crd, segment, bd_scope, ia_scope, bd_disclosure_count, branches_count, main_office_city, main_office_state, main_office_country, finra_fetched_at, deals_24mo, deals_506c_24mo, deals_90d, capital_placed_24mo, capital_placed_90d, share_506c_pct, momentum_pct, last_deal_at, last_506c_deal_at, industries"
      )
      .eq("firm_id", firmId)
      .maybeSingle(),
    sb
      .from("v_firm_recent_deals")
      .select(
        "accession_no, issuer_name, filed_at, total_offering, rule_506b, rule_506c, rule_504"
      )
      .eq("firm_id", firmId)
      .order("filed_at", { ascending: false })
      .order("accession_no", { ascending: false })
      .limit(RECENT_DEALS_LIMIT * 2),
  ]);

  if (bdRes.error) {
    console.error("[numena] getBdProfile firm:", bdRes.error.message);
    return null;
  }
  const bd = bdRes.data as BdRow | null;
  if (!bd) return null;

  const seen = new Set<string>();
  const recentDeals: BdRecentDeal[] = [];
  for (const d of (dealsRes.data ?? []) as DealRow[]) {
    if (seen.has(d.accession_no)) continue;
    seen.add(d.accession_no);
    recentDeals.push({
      accessionNo: d.accession_no,
      issuer: d.issuer_name ?? "Unknown issuer",
      filedAt: d.filed_at,
      offeringAmount: toNum(d.total_offering),
      exemption: exemptionLabel(d),
    });
    if (recentDeals.length >= RECENT_DEALS_LIMIT) break;
  }

  return {
    firmId: bd.firm_id,
    name: bd.name ?? "Unknown firm",
    crd: bd.crd || null,
    segment: bd.segment,
    bdScope: bd.bd_scope,
    iaScope: bd.ia_scope,
    disclosures: toNum(bd.bd_disclosure_count),
    branches: toNum(bd.branches_count),
    location: location(bd),
    finraFetchedAt: bd.finra_fetched_at,
    deals24mo: toNum(bd.deals_24mo) ?? 0,
    deals506c24mo: toNum(bd.deals_506c_24mo) ?? 0,
    deals90d: toNum(bd.deals_90d) ?? 0,
    capitalPlaced24mo: toNum(bd.capital_placed_24mo),
    capitalPlaced90d: toNum(bd.capital_placed_90d),
    share506cPct: toNum(bd.share_506c_pct),
    momentumPct: toNum(bd.momentum_pct),
    lastDealAt: bd.last_deal_at,
    last506cDealAt: bd.last_506c_deal_at,
    industries: bd.industries ?? [],
    recentDeals,
  };
}
