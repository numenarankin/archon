import "server-only";
import type { Commodity, PricePoint } from "@/lib/pricing/types";
import { getTransactions } from "@/lib/accounting/ledger";
import type { Transaction } from "@/lib/accounting/types";

/**
 * Posted prices the org actually received for its oil and gas, derived from the
 * accounting ledger.
 *
 * Method: revenue is cash-basis, dated by receipt month, and lands ~one month
 * after the production month. For each commodity we take that month's revenue
 * rows (REV-OIL / REV-GAS), volume-weight them — Σ amount ÷ Σ volume — to get
 * the realized price, then attribute it to the production month (receipt − 1).
 * The price is assumed constant across that month, so we emit a flat daily
 * series: one point per calendar day at the monthly average. Oil is $/bbl, gas
 * is $/MCF (the volume unit on the rows).
 */

const log = (...args: unknown[]) => console.log("[posted-prices]", ...args);

/**
 * Which commodity a revenue row is for, inferred from its category code + label
 * (e.g. "REV-OIL", "Oil Sales", or a numeric code with an "Oil Sales" label).
 * Returns null when neither or both appear (a combined "Oil & Gas" label is
 * ambiguous, so we skip it rather than double-count).
 */
export function commodityOf(t: Transaction): Commodity | null {
  const text = `${t.categoryCode ?? ""} ${t.category ?? ""}`.toLowerCase();
  const isOil = text.includes("oil");
  const isGas = text.includes("gas");
  if (isOil === isGas) return null;
  return isOil ? "oil" : "gas";
}

/** The production month ("YYYY-MM") one month before a receipt month. */
export function priorMonth(receiptMonth: string): string {
  const [year, month] = receiptMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1)); // 1st of the receipt month
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** A flat daily price series spanning every calendar day of "YYYY-MM". */
function flatMonth(month: string, price: number): PricePoint[] {
  const [year, m] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this month.
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const points: PricePoint[] = [];
  for (let day = 1; day <= days; day++) {
    points.push({
      date: `${month}-${String(day).padStart(2, "0")}`,
      price,
    });
  }
  return points;
}

/** Volume-weighted realized price per production month, as a flat daily series. */
function seriesFor(
  transactions: Transaction[],
  commodity: Commodity
): PricePoint[] {
  // Sum revenue + sold volume per receipt month for this commodity.
  const byReceiptMonth = new Map<string, { amount: number; volume: number }>();
  let matched = 0;
  let droppedNoVolume = 0;
  for (const t of transactions) {
    if (t.kind !== "revenue" || commodityOf(t) !== commodity) continue;
    matched++;
    const volume = t.volume ?? 0;
    if (volume <= 0) {
      droppedNoVolume++; // can't weight without a denominator
      continue;
    }
    const key = t.date.slice(0, 7); // YYYY-MM
    const agg = byReceiptMonth.get(key) ?? { amount: 0, volume: 0 };
    agg.amount += t.amount;
    agg.volume += volume;
    byReceiptMonth.set(key, agg);
  }

  const monthly = [...byReceiptMonth.entries()].map(
    ([receiptMonth, { amount, volume }]) => ({
      receiptMonth,
      productionMonth: priorMonth(receiptMonth),
      amount,
      volume,
      price: volume > 0 ? amount / volume : null,
    })
  );
  log(
    `${commodity}: ${matched} revenue rows matched`,
    droppedNoVolume ? `(${droppedNoVolume} skipped: no volume)` : "",
    "→ monthly:",
    monthly.map((m) => ({
      receipt: m.receiptMonth,
      prod: m.productionMonth,
      price: m.price?.toFixed(2),
    }))
  );

  const points: PricePoint[] = [];
  for (const m of monthly) {
    if (m.price == null) continue;
    points.push(...flatMonth(m.productionMonth, m.price));
  }
  points.sort((a, b) => (a.date < b.date ? -1 : 1));
  return points;
}

export async function getPostedPrices(): Promise<
  Record<Commodity, PricePoint[]>
> {
  const transactions = await getTransactions();

  // Diagnostics: what the ledger actually returned, and the spread of category
  // codes on revenue rows (so a mismatch with REV-OIL / REV-GAS is obvious).
  const revenue = transactions.filter((t) => t.kind === "revenue");
  const codeCounts: Record<string, number> = {};
  const withVolume = revenue.filter((t) => (t.volume ?? 0) > 0).length;
  for (const t of revenue) {
    const code = `${t.categoryCode?.trim() || "(empty)"} | ${t.category || "(no label)"}`;
    codeCounts[code] = (codeCounts[code] ?? 0) + 1;
  }
  log(
    `loaded ${transactions.length} transactions,`,
    `${revenue.length} revenue (${withVolume} with volume>0).`,
    "revenue 'code | label' counts:",
    codeCounts
  );

  const oil = seriesFor(transactions, "oil");
  const gas = seriesFor(transactions, "gas");
  log(`result → oil: ${oil.length} daily points, gas: ${gas.length}`);

  return { oil, gas };
}
