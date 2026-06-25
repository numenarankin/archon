/**
 * Pure derivation helpers — every figure on the budgeting page is computed from
 * the flat transaction ledger here. No server or DB imports, so these run on the
 * client too.
 */
import type {
  CategorySummary,
  DraftTransaction,
  FinancialPoint,
  Transaction,
} from "@/lib/budgeting/types";

/** A blank expense draft dated `date` (ISO `YYYY-MM-DD`). */
export function emptyDraft(date: string): DraftTransaction {
  return {
    kind: "expense",
    payee: "",
    amount: 0,
    date,
    category: "",
    categoryCode: "",
    note: "",
    account: "",
  };
}

/** Normalizes any ISO date to the first day of its month (`YYYY-MM-01`). */
export function monthKey(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Aggregates transactions into monthly income / expenses / net cash flow. */
export function aggregateMonthly(txns: Transaction[]): FinancialPoint[] {
  const byMonth = new Map<string, FinancialPoint>();
  for (const t of txns) {
    const key = monthKey(t.date);
    const point = byMonth.get(key) ?? {
      month: key,
      income: 0,
      expenses: 0,
      net: 0,
    };
    if (t.kind === "income") point.income += t.amount;
    else point.expenses += t.amount;
    byMonth.set(key, point);
  }
  return [...byMonth.values()]
    .map((p) => ({ ...p, net: p.income - p.expenses }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

/**
 * Totals transactions per category (income and expense kept as separate rows),
 * largest total first — the overview's "where the money goes" table.
 */
export function summarizeByCategory(txns: Transaction[]): CategorySummary[] {
  const byCategory = new Map<string, CategorySummary>();
  for (const t of txns) {
    const code = t.categoryCode || "UNCATEGORIZED";
    const label = t.category || "Uncategorized";
    const key = `${t.kind}:${code}`;
    const row = byCategory.get(key) ?? {
      categoryCode: code,
      category: label,
      kind: t.kind,
      total: 0,
    };
    row.total += t.amount;
    byCategory.set(key, row);
  }
  return [...byCategory.values()].sort((a, b) => b.total - a.total);
}
