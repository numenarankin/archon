import "server-only";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

/** One uploaded file (a batch of transactions) shown in the Uploads tab. */
export interface BudgetUpload {
  id: string;
  fileName: string;
  mime: string | null;
  size: number | null;
  /** Number of transactions created from this upload. */
  txnCount: number;
  /** Sum of the batch's transaction amounts (USD). */
  totalAmount: number;
  createdAt: string;
}

interface UploadRow {
  id: string;
  file_name: string | null;
  mime: string | null;
  size: number | null;
  txn_count: number | null;
  total_amount: number | null;
  created_at: string;
}

function mapUpload(r: UploadRow): BudgetUpload {
  return {
    id: r.id,
    fileName: r.file_name ?? "",
    mime: r.mime,
    size: r.size,
    txnCount: r.txn_count ?? 0,
    totalAmount: r.total_amount ?? 0,
    createdAt: r.created_at,
  };
}

/** Every upload batch, newest first. */
export async function getUploads(): Promise<BudgetUpload[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("budget_uploads")
    .select("id, file_name, mime, size, txn_count, total_amount, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getUploads: ${error.message}`);
  return ((data ?? []) as UploadRow[]).map(mapUpload);
}
