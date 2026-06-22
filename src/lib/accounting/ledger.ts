import "server-only";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  aggregateMonthly,
  summarizeByWell,
} from "@/lib/accounting/derive";
import type {
  AccountingOverview,
  Transaction,
  TransactionKind,
} from "@/lib/accounting/types";

interface TransactionRow {
  id: string;
  kind: TransactionKind;
  counterparty: string | null;
  amount: number | null;
  txn_date: string;
  category: string | null;
  category_code: string | null;
  invoice_number: string | null;
  well_id: string | null;
  volume: number | null;
  price: number | null;
  prod_tax: number | null;
  nri: number | null;
  created_at: string;
  /** Joined well name (single object via FK). */
  wells: { name: string | null } | null;
}

const SELECT =
  "id, kind, counterparty, amount, txn_date, category, category_code, " +
  "invoice_number, well_id, volume, price, prod_tax, nri, created_at, wells(name)";

function mapTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    kind: r.kind,
    counterparty: r.counterparty ?? "",
    amount: r.amount ?? 0,
    date: r.txn_date,
    category: r.category ?? "",
    categoryCode: r.category_code ?? "",
    invoiceNumber: r.invoice_number ?? "",
    wellId: r.well_id ?? "",
    wellName: r.wells?.name ?? r.well_id ?? "",
    volume: r.volume,
    price: r.price,
    prodTax: r.prod_tax,
    nri: r.nri,
    createdAt: r.created_at,
  };
}

/** Returns every transaction in the ledger, oldest first. */
export async function getTransactions(): Promise<Transaction[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("transactions")
    .select(SELECT)
    .order("txn_date", { ascending: true });
  if (error) throw new Error(`getTransactions: ${error.message}`);
  return ((data ?? []) as unknown as TransactionRow[]).map(mapTransaction);
}

/**
 * Returns the accounting overview: monthly totals across all wells (aggregate
 * chart) and per-well totals (sortable table), both derived from the ledger.
 */
export async function getAccountingOverview(): Promise<AccountingOverview> {
  const txns = await getTransactions();
  return { series: aggregateMonthly(txns), wells: summarizeByWell(txns) };
}

/**
 * Returns one well's full transaction history (oldest first) and its name, or
 * `null` when the well does not exist. The per-well page derives the monthly
 * chart, table, and reports from these rows.
 */
export async function getWellLedger(
  wellId: string
): Promise<{ wellName: string; transactions: Transaction[] } | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();

  const { data: well, error: wellError } = await sb
    .from("wells")
    .select("name")
    .eq("id", wellId)
    .maybeSingle();
  if (wellError) throw new Error(`getWellLedger: ${wellError.message}`);
  if (!well) return null;

  const { data, error } = await sb
    .from("transactions")
    .select(SELECT)
    .eq("well_id", wellId)
    .order("txn_date", { ascending: true });
  if (error) throw new Error(`getWellLedger: ${error.message}`);

  const transactions = ((data ?? []) as unknown as TransactionRow[]).map(
    mapTransaction
  );
  return { wellName: well.name ?? wellId, transactions };
}
