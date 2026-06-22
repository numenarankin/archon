import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCommodityQuotes } from "@/lib/pricing/feed";
import { getTransactions } from "@/lib/accounting/ledger";
import { commodityOf, priorMonth } from "@/lib/pricing/posted-prices";
import {
  OIL_PRICE_PER_BBL,
  GAS_PRICE_PER_MCF,
  type CommodityPrices,
  type MonthlyProduction,
  type WellProductionTotal,
  type ProductionLogRow,
  type CompanyAnalytics,
} from "./types";

// Types + pricing constants live in the pure `./types` module so client
// components can import them without pulling this server-only file (and its
// `server-only` ledger dependency) into the browser bundle. Re-exported here so
// existing server-side importers keep working.
export {
  OIL_PRICE_PER_BBL,
  GAS_PRICE_PER_MCF,
  type CommodityPrices,
  type MonthlyProduction,
  type WellProductionTotal,
  type ProductionLogRow,
  type CompanyAnalytics,
};

const EMPTY: CompanyAnalytics = {
  monthly: [],
  byWell: [],
  log: [],
  prices: { oilPerBbl: OIL_PRICE_PER_BBL, gasPerMcf: GAS_PRICE_PER_MCF },
};

interface ReadingRow {
  id: string;
  well_id: string;
  reading_date: string;
  reading_time: string | null;
  oil_production: number | null;
  oil_stock: number | null;
  oil_sales: number | null;
  gas_production: number | null;
  salt_water: number | null;
}

/** A well's figures for one month, from one source. */
interface WellMonth {
  oilBbl: number;
  gasMcf: number;
  water: number;
  revenue: number;
  cashFlow: number;
  official: boolean;
}

function blankWellMonth(official: boolean): WellMonth {
  return { oilBbl: 0, gasMcf: 0, water: 0, revenue: 0, cashFlow: 0, official };
}

/**
 * The analytics dataset, merged from two sources per well:
 *
 * - **Accounting (official):** the record of truth — what the company was paid.
 *   Revenue is cash-basis; we attribute it to the production month (receipt − 1,
 *   matching the posted-price logic) and split oil vs gas by category.
 * - **Production reports (unofficial):** self-reported daily readings, used only
 *   for months AFTER a well's latest accounting month, valued at live prices.
 *
 * The cutoff is per well, so each well switches from official to unofficial at
 * its own latest accounting month — no month is ever counted from both sources.
 * Oil readings are stored in barrels (converted at write time), so no gauge
 * conversion happens here. Salt water has no accounting analogue, so it always
 * comes from the production reports.
 */
export async function getCompanyAnalytics(): Promise<CompanyAnalytics> {
  if (!hasSupabase()) return EMPTY;
  const sb = await getSupabaseServer();

  const [quotes, transactions, wellsRes, readingsRes] = await Promise.all([
    getCommodityQuotes(),
    getTransactions(),
    sb.from("wells").select("id, name"),
    sb
      .from("production_readings")
      .select(
        "id, well_id, reading_date, reading_time, oil_production, oil_stock, oil_sales, gas_production, salt_water"
      )
      .order("reading_date", { ascending: true })
      .order("reading_time", { ascending: true }),
  ]);

  if (wellsRes.error) {
    throw new Error(`getCompanyAnalytics (wells): ${wellsRes.error.message}`);
  }
  if (readingsRes.error) {
    throw new Error(`getCompanyAnalytics (readings): ${readingsRes.error.message}`);
  }

  const oilPrice =
    quotes.find((q) => q.label === "WTI")?.price ?? OIL_PRICE_PER_BBL;
  const gasPrice =
    quotes.find((q) => q.label === "Nat Gas")?.price ?? GAS_PRICE_PER_MCF;
  const prices: CommodityPrices = { oilPerBbl: oilPrice, gasPerMcf: gasPrice };

  const nameByWell = new Map<string, string>();
  for (const w of wellsRes.data ?? []) nameByWell.set(w.id, w.name);

  // wellId → month → merged figures. Accounting fills it first (official); the
  // production pass only fills months a well has no accounting for.
  const byWellMonth = new Map<string, Map<string, WellMonth>>();
  const cutoff = new Map<string, string>(); // wellId → latest official month

  function cell(wellId: string, month: string, official: boolean): WellMonth {
    let months = byWellMonth.get(wellId);
    if (!months) {
      months = new Map();
      byWellMonth.set(wellId, months);
    }
    let wm = months.get(month);
    if (!wm) {
      wm = blankWellMonth(official);
      months.set(month, wm);
    }
    return wm;
  }

  // --- Pass 1: accounting (official) ---------------------------------------
  // Cutoff is set from REVENUE production-months (the production signal); the
  // money the company was actually paid for.
  for (const t of transactions) {
    if (!t.wellId) continue;
    if (t.kind === "revenue") {
      const month = priorMonth(t.date.slice(0, 7));
      const wm = cell(t.wellId, month, true);
      wm.revenue += t.amount;
      wm.cashFlow += t.amount;
      const c = commodityOf(t);
      if (c === "oil") wm.oilBbl += t.volume ?? 0;
      else if (c === "gas") wm.gasMcf += t.volume ?? 0;
      const cur = cutoff.get(t.wellId);
      if (!cur || month > cur) cutoff.set(t.wellId, month);
    }
  }
  // Expenses (payment month) reduce cash flow, but only within the official
  // window — months after the cutoff belong to the unofficial production view.
  for (const t of transactions) {
    if (!t.wellId || t.kind !== "expense") continue;
    const month = t.date.slice(0, 7);
    const cut = cutoff.get(t.wellId);
    if (!cut || month > cut) continue;
    cell(t.wellId, month, true).cashFlow -= t.amount;
  }

  // --- Pass 2: production reports ------------------------------------------
  // Oil/gas/revenue only for months AFTER the well's cutoff (unofficial). Water
  // has no accounting analogue, so it's always taken from the reports.
  const log: ProductionLogRow[] = [];
  for (const r of (readingsRes.data ?? []) as ReadingRow[]) {
    const month = r.reading_date.slice(0, 7);
    const name = nameByWell.get(r.well_id) ?? r.well_id;
    const oilBbl = r.oil_production ?? 0;
    const gas = r.gas_production ?? 0;
    const water = r.salt_water ?? 0;
    const cut = cutoff.get(r.well_id);
    const unofficial = !cut || month > cut;

    if (unofficial) {
      const wm = cell(r.well_id, month, false);
      wm.oilBbl += oilBbl;
      wm.gasMcf += gas;
      wm.revenue += oilBbl * oilPrice + gas * gasPrice;
      wm.official = false;
    }
    // Water always comes from the reports (any month).
    cell(r.well_id, month, cut ? month <= cut : false).water += water;

    log.push({
      id: r.id,
      wellId: r.well_id,
      wellName: name,
      date: r.reading_date,
      time: (r.reading_time ?? "").slice(0, 5),
      oilProduction: oilBbl,
      oilStock: r.oil_stock ?? 0,
      oilSales: r.oil_sales ?? 0,
      gasProduction: gas,
      saltWater: water,
    });
  }

  // --- Aggregate to company-monthly + per-well totals ----------------------
  const monthlyByKey = new Map<string, MonthlyProduction>();
  const totalsByWell = new Map<string, WellProductionTotal>();

  for (const [wellId, months] of byWellMonth) {
    const name = nameByWell.get(wellId) ?? wellId;
    const wellTotal = totalsByWell.get(wellId) ?? {
      wellId,
      name,
      oilBbl: 0,
      gasMcf: 0,
      revenue: 0,
      cashFlow: 0,
    };

    for (const [month, wm] of months) {
      const m = monthlyByKey.get(month) ?? {
        month,
        oilBbl: 0,
        gasMcf: 0,
        water: 0,
        revenue: 0,
        cashFlow: 0,
        official: true,
      };
      m.oilBbl += wm.oilBbl;
      m.gasMcf += wm.gasMcf;
      m.water += wm.water;
      m.revenue += wm.revenue;
      m.cashFlow += wm.cashFlow;
      if (!wm.official) m.official = false; // any unofficial contributor taints
      monthlyByKey.set(month, m);

      wellTotal.oilBbl += wm.oilBbl;
      wellTotal.gasMcf += wm.gasMcf;
      wellTotal.revenue += wm.revenue;
      wellTotal.cashFlow += wm.cashFlow;
    }
    totalsByWell.set(wellId, wellTotal);
  }

  const monthly = [...monthlyByKey.values()].sort((a, b) =>
    a.month < b.month ? -1 : 1
  );
  const byWell = [...totalsByWell.values()].sort((a, b) => b.revenue - a.revenue);
  log.sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
  );

  return { monthly, byWell, log, prices };
}
