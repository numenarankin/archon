import "server-only";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  aggregateMonthly,
  summarizeByCategory,
} from "@/lib/budgeting/derive";
import type {
  BudgetOverview,
  Transaction,
  TransactionKind,
} from "@/lib/budgeting/types";

interface TransactionRow {
  id: string;
  kind: TransactionKind;
  payee: string | null;
  amount: number | null;
  txn_date: string;
  category: string | null;
  category_code: string | null;
  note: string | null;
  account: string | null;
  created_at: string;
}

const SELECT =
  "id, kind, payee, amount, txn_date, category, category_code, note, account, created_at";

function mapTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    kind: r.kind,
    payee: r.payee ?? "",
    amount: r.amount ?? 0,
    date: r.txn_date,
    category: r.category ?? "",
    categoryCode: r.category_code ?? "",
    note: r.note ?? "",
    account: r.account ?? "",
    createdAt: r.created_at,
  };
}

/** Returns every transaction in the budget ledger, oldest first. */
export async function getTransactions(): Promise<Transaction[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("budget_transactions")
    .select(SELECT)
    .order("txn_date", { ascending: true });
  if (error) throw new Error(`getTransactions: ${error.message}`);
  return ((data ?? []) as unknown as TransactionRow[]).map(mapTransaction);
}

/**
 * Returns the budgeting overview: monthly totals (aggregate chart) and
 * per-category totals (table), both derived from the ledger.
 */
export async function getBudgetOverview(): Promise<BudgetOverview> {
  const txns = await getTransactions();
  return {
    series: aggregateMonthly(txns),
    categories: summarizeByCategory(txns),
  };
}
