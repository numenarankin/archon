/** Budgeting-page shared types. Pure module, safe on client and server. */

/** Money in vs money out. */
export type TransactionKind = "income" | "expense";

/** The three series tracked over time, derived from the ledger. */
export type FinancialMetric = "income" | "expenses" | "net";

/** Display metadata for a financial metric (chart label + line color). */
export interface FinancialMetricMeta {
  key: FinancialMetric;
  label: string;
  color: string;
}

export const FINANCIAL_METRICS: Record<FinancialMetric, FinancialMetricMeta> = {
  income: { key: "income", label: "Income", color: "#059669" },
  expenses: { key: "expenses", label: "Expenses", color: "#800000" },
  net: { key: "net", label: "Net Cash Flow", color: "#4169e1" },
};

/** Stable display / dropdown order for the metrics. */
export const FINANCIAL_METRIC_ORDER: FinancialMetric[] = [
  "income",
  "expenses",
  "net",
];

/** One row of the budget ledger. */
export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** Income source or expense merchant / payee. */
  payee: string;
  /** Dollar amount (USD), always positive. */
  amount: number;
  /** Transaction date, ISO `YYYY-MM-DD`. */
  date: string;
  category: string;
  categoryCode: string;
  /** Free-form note / reference. */
  note: string;
  /** Which account it hit, e.g. "Checking", "Credit Card". */
  account: string;
  /** When the row was added to the ledger (ISO timestamp). */
  createdAt: string;
}

/**
 * A transaction before it is persisted — the editable shape used by the manual
 * entry form and the OCR draft editor. Held in memory until saved.
 */
export interface DraftTransaction {
  kind: TransactionKind;
  payee: string;
  amount: number;
  date: string;
  category: string;
  categoryCode: string;
  note: string;
  account: string;
}

/** One month of derived totals (ISO `YYYY-MM-01`, first of month; USD). */
export interface FinancialPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

/** Per-category totals over the available period, for the overview table. */
export interface CategorySummary {
  categoryCode: string;
  category: string;
  kind: TransactionKind;
  total: number;
}

/** Everything the budgeting overview tab renders. */
export interface BudgetOverview {
  /** Monthly totals, oldest month first. */
  series: FinancialPoint[];
  /** Per-category totals, largest first. */
  categories: CategorySummary[];
}
