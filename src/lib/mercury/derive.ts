import type {
  CashSnapshot,
  MercuryTransaction,
} from "./types";

/**
 * Walk settled transactions backwards from the live `availableBalance` total
 * to derive a daily cash time-series. Mercury does not expose a balance-history
 * endpoint, so this is the standard approach.
 */
export function deriveCashSeries(
  txns: MercuryTransaction[],
  currentTotalAvailable: number,
  days = 180,
  asOf: Date = new Date()
): CashSnapshot[] {
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);

  const byDay = new Map<string, number>();
  for (const t of txns) {
    if (t.status !== "sent") continue;
    if (!t.postedAt) continue;
    const day = t.postedAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount);
  }

  const series: CashSnapshot[] = [];
  let running = currentTotalAvailable;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    series.push({ date: day, cash: Math.round(running) });
    running -= byDay.get(day) ?? 0;
  }
  return series.reverse();
}

export function avgMonthlyBurn(
  txns: MercuryTransaction[],
  months = 3,
  asOf: Date = new Date()
): number {
  const cutoff = new Date(asOf);
  cutoff.setMonth(cutoff.getMonth() - months);
  const outflow = txns
    .filter(
      (t) =>
        t.status === "sent" &&
        t.amount < 0 &&
        new Date(t.postedAt ?? t.createdAt) >= cutoff
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return outflow / months;
}

export function topCounterpartiesByOutflow(
  txns: MercuryTransaction[],
  days = 90,
  topN = 8,
  asOf: Date = new Date()
): { counterparty: string; spend: number }[] {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - days);
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (t.status !== "sent" || t.amount >= 0) continue;
    if (new Date(t.postedAt ?? t.createdAt) < cutoff) continue;
    const key = t.counterpartyNickname ?? t.counterpartyName;
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(t.amount));
  }
  return Array.from(totals, ([counterparty, spend]) => ({ counterparty, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, topN);
}
