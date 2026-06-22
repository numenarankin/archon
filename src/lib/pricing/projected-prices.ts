import "server-only";
import type { Commodity, PricePoint } from "@/lib/pricing/types";
import { getPriceHistory } from "@/lib/pricing/feed";

/**
 * Forward-projected posted prices, filling the gap between the last actual
 * posted month and the current month (accounting arrives ~a month late, but the
 * benchmark is live). Posted price tracks its benchmark roughly 1:1 offset by a
 * basis differential (location / quality / transport / marketing), so we:
 *
 *   1. estimate the differential = mean over posted months of
 *      (avg benchmark that month − posted that month), and
 *   2. project each later month as avg benchmark that month − differential,
 *      emitted as a flat daily series (current month only through today).
 *
 * This is a linear model with the slope pinned to 1 — robust with even one
 * posted month, and it rides the benchmark instead of extrapolating a fitted
 * slope. To graduate to a free-slope OLS fit later, swap `estimateModel`.
 */

const COMMODITIES: Commodity[] = ["oil", "gas"];

const monthOf = (isoDate: string) => isoDate.slice(0, 7); // "YYYY-MM"

/** Flat daily posted series → month → price. */
function postedByMonth(series: PricePoint[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const p of series) byMonth.set(monthOf(p.date), p.price);
  return byMonth;
}

/** Daily benchmark series → month → average price. */
function benchmarkByMonth(series: PricePoint[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const p of series) {
    const key = monthOf(p.date);
    const e = acc.get(key) ?? { sum: 0, n: 0 };
    e.sum += p.price;
    e.n += 1;
    acc.set(key, e);
  }
  const avg = new Map<string, number>();
  for (const [key, { sum, n }] of acc) avg.set(key, sum / n);
  return avg;
}

function lastDayOfMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1)); // 1st of this month
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The basis differential to subtract from the benchmark — the volume-agnostic
 * mean of (benchmark − posted) across months where we have both. Returns null
 * when there's no overlap to anchor it.
 */
function estimateModel(
  posted: Map<string, number>,
  benchmark: Map<string, number>
): { differential: number } | null {
  let sum = 0;
  let n = 0;
  for (const [month, postedPrice] of posted) {
    const b = benchmark.get(month);
    if (b == null) continue;
    sum += b - postedPrice;
    n += 1;
  }
  return n > 0 ? { differential: sum / n } : null;
}

async function projectFor(
  commodity: Commodity,
  postedSeries: PricePoint[],
  today: string
): Promise<PricePoint[]> {
  const posted = postedByMonth(postedSeries);
  if (posted.size === 0) return []; // nothing to anchor a projection on

  const months = [...posted.keys()].sort();
  const lastPosted = months[months.length - 1];

  // A year of daily benchmark, independent of the chart's display range, so the
  // anchor month(s) and every projection month are covered.
  const history = await getPriceHistory(commodity, "12M");
  const benchmark = benchmarkByMonth(history);

  const model = estimateModel(posted, benchmark);
  if (!model) return []; // benchmark history doesn't overlap the posted month(s)

  const currentMonth = monthOf(today);
  const todayDay = Number(today.slice(8, 10));

  const points: PricePoint[] = [];
  // Bridge the solid line into the faded one: start at the last actual point.
  points.push({
    date: `${lastPosted}-${String(lastDayOfMonth(lastPosted)).padStart(2, "0")}`,
    price: posted.get(lastPosted) as number,
  });

  for (let month = nextMonth(lastPosted); month <= currentMonth; month = nextMonth(month)) {
    const b = benchmark.get(month);
    if (b == null) continue; // no benchmark data for this month yet
    const price = b - model.differential;
    // Don't project days that haven't happened yet in the current month.
    const maxDay = month === currentMonth ? todayDay : lastDayOfMonth(month);
    for (let day = 1; day <= maxDay; day++) {
      points.push({ date: `${month}-${String(day).padStart(2, "0")}`, price });
    }
  }

  // Only the bridge point means there's nothing actually projected — drop it.
  return points.length > 1 ? points : [];
}

export async function getProjectedPrices(
  posted: Record<Commodity, PricePoint[]>
): Promise<Record<Commodity, PricePoint[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const entries = await Promise.all(
    COMMODITIES.map(
      async (c) => [c, await projectFor(c, posted[c], today)] as const
    )
  );
  return Object.fromEntries(entries) as Record<Commodity, PricePoint[]>;
}
