/**
 * Analytics types + pure pricing constants. This module is PURE (no server
 * imports) so client components — the production chart, pie, and log table — can
 * import these shapes without dragging the server-only data layer
 * (`./analytics` → `@/lib/accounting/ledger`, which is `server-only`) into the
 * browser bundle. Server-side data access lives in `./analytics`.
 */

/**
 * Last-resort commodity prices, used only when the live price feed is
 * unavailable, so dollar figures never collapse to zero. Real valuation uses the
 * current WTI / Henry Hub quotes from the price feed (see `getCompanyAnalytics`).
 */
export const OIL_PRICE_PER_BBL = 75;
export const GAS_PRICE_PER_MCF = 2.5;

/** The commodity prices used to value production, in USD. */
export interface CommodityPrices {
  /** Oil price, USD per barrel (WTI from the feed, or the fallback). */
  oilPerBbl: number;
  /** Gas price, USD per MCF (Henry Hub from the feed, or the fallback). */
  gasPerMcf: number;
}

/**
 * Company-wide production + dollars for one month, merged across the two
 * sources. Months the accounting ledger covers are `official` (the record of
 * truth — what the company was paid for); later months fall back to the
 * self-reported production reports and are flagged unofficial.
 */
export interface MonthlyProduction {
  /** Month as `YYYY-MM`. */
  month: string;
  /** Oil, in barrels. */
  oilBbl: number;
  /** Gas, in MCF. */
  gasMcf: number;
  /** Produced (salt) water, in barrels (always from production reports). */
  water: number;
  /** Net revenue — actual (official) or volume×price estimate (unofficial). */
  revenue: number;
  /** Cash flow (revenue − expenses); 0 for unofficial months (no expenses). */
  cashFlow: number;
  /** True when every well's figures for the month come from accounting. */
  official: boolean;
}

/** A single well's production totals + actual accounting figures. */
export interface WellProductionTotal {
  wellId: string;
  name: string;
  oilBbl: number;
  gasMcf: number;
  /** Actual net revenue booked to this well in the ledger, USD. */
  revenue: number;
  /** Actual cash flow (revenue − expenses) for this well, USD. */
  cashFlow: number;
}

/** One production reading across the company, with its well + oil in barrels. */
export interface ProductionLogRow {
  id: string;
  wellId: string;
  wellName: string;
  date: string;
  time: string;
  /** Oil figures are in barrels (already converted from gauge inches). */
  oilProduction: number;
  oilStock: number;
  oilSales: number;
  gasProduction: number;
  saltWater: number;
}

export interface CompanyAnalytics {
  /** Merged monthly series (accounting where official, production after). */
  monthly: MonthlyProduction[];
  byWell: WellProductionTotal[];
  log: ProductionLogRow[];
  /** Prices used to value production in dollars (from the live feed). */
  prices: CommodityPrices;
}
