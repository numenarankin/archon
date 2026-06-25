import "server-only";

import { MercuryClient } from "./client";
import {
  avgMonthlyBurn,
  deriveCashSeries,
  topCounterpartiesByOutflow,
} from "./derive";
import type { FinanceData } from "./types";

/**
 * Fetch everything the /finance page needs in one trip.
 * Server-only. Uses Mercury read endpoints in parallel.
 */
export async function fetchFinanceData(opts: {
  apiKey: string;
  sandbox?: boolean;
  /** Window of transactions to fetch for derived series (default 180 days). */
  daysOfHistory?: number;
  /** Cache hint (seconds) or 'no-store'. */
  revalidate?: number | "no-store";
}): Promise<FinanceData> {
  const client = new MercuryClient({
    apiKey: opts.apiKey,
    sandbox: opts.sandbox,
    revalidate: opts.revalidate ?? "no-store",
  });

  const days = opts.daysOfHistory ?? 180;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);

  const [accountsRes, transactions] = await Promise.all([
    client.listAccounts(),
    client.listAllTransactions({
      start: startStr,
      order: "desc",
    }),
  ]);

  const accounts = accountsRes.accounts;
  const totalAvailable = accounts.reduce(
    (sum, a) => sum + a.availableBalance,
    0
  );
  const totalCurrent = accounts.reduce(
    (sum, a) => sum + a.currentBalance,
    0
  );

  return {
    accounts,
    totalAvailable,
    totalCurrent,
    transactions,
    moneyIn: transactions.filter((t) => t.amount > 0),
    moneyOut: transactions.filter((t) => t.amount < 0),
    cashSeries: deriveCashSeries(transactions, totalAvailable, days),
    burnPerMonth: avgMonthlyBurn(transactions, 3),
    topCounterparties: topCounterpartiesByOutflow(transactions, 90, 8),
    isLive: true,
  };
}
