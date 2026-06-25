"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { BUDGET_UPLOAD_BUCKET as UPLOAD_BUCKET } from "@/lib/budgeting/storage";
import { requireUser } from "@/lib/auth/session";
import type { DraftTransaction } from "@/lib/budgeting/types";

/**
 * Budget-uploads object keys are namespaced `<owner_id>/<uuid>` so a stored
 * object can be tied to its owner. This guards the admin-client storage ops
 * (download/remove) against a forged key referencing another user's object —
 * the bucket is accessed via the RLS-bypassing service role, so the prefix is
 * the ownership signal at the points where no DB row exists yet (extract/discard).
 */
function isOwnedBudgetKey(key: string, ownerId: string): boolean {
  return key.startsWith(`${ownerId}/`);
}

const draftSchema = z.object({
  kind: z.enum(["income", "expense"]),
  payee: z.string().trim().default(""),
  amount: z.number().finite().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date"),
  category: z.string().trim().default(""),
  categoryCode: z.string().trim().default(""),
  note: z.string().trim().default(""),
  account: z.string().trim().default(""),
});

/** Maps a validated draft to a ledger row. */
function toRow(d: DraftTransaction) {
  return {
    kind: d.kind,
    payee: d.payee || null,
    amount: d.amount,
    txn_date: d.date,
    category: d.category || null,
    category_code: d.categoryCode || null,
    note: d.note || null,
    account: d.account || null,
  };
}

function revalidate(): void {
  revalidatePath("/budgeting");
}

/**
 * Persists one or more transactions to the ledger. Used both by the manual
 * entry form (single) and the OCR upload flow (a batch of reviewed drafts).
 */
export async function createTransactions(
  drafts: DraftTransaction[]
): Promise<{ created: number }> {
  if (drafts.length === 0) return { created: 0 };

  const parsed = z.array(draftSchema).parse(drafts);
  const rows = parsed.map(toRow);

  const sb = await getSupabaseServer();
  const { error } = await sb.from("budget_transactions").insert(rows);
  if (error) throw new Error(`createTransactions: ${error.message}`);

  revalidate();
  return { created: rows.length };
}

/** The reviewed batch the client commits after OCR: drafts plus a pointer to
 * the already-uploaded source file (uploaded direct-to-storage, so it never
 * passes through this function and isn't bounded by the serverless body cap). */
const saveBatchSchema = z.object({
  drafts: z.array(draftSchema),
  storageKey: z.string().min(1).nullable().default(null),
  fileName: z.string().default("upload"),
  mime: z.string().nullable().default(null),
  size: z.number().int().nonnegative().nullable().default(null),
});

/**
 * Mint a one-time signed upload URL so the browser can stream a (potentially
 * large) file straight to private Storage, bypassing the platform's serverless
 * request-body limit that a multipart POST would hit. The client uploads with
 * `uploadToSignedUrl(path, token, file)`, then hands `path` back to the extract
 * route and to `saveUploadedTransactions`.
 */
export async function createBudgetUploadTarget(): Promise<{
  bucket: string;
  path: string;
  token: string;
}> {
  const user = await requireUser();
  const path = `${user.id}/${crypto.randomUUID()}`;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(
      `createBudgetUploadTarget: ${error?.message ?? "no signed URL"}`
    );
  }
  return { bucket: UPLOAD_BUCKET, path, token: data.token };
}

/**
 * Best-effort delete of an uploaded-but-never-saved temp object (the user
 * closed the modal or replaced the file). Never throws — cleanup is advisory.
 */
export async function discardBudgetUpload(storageKey: string): Promise<void> {
  if (!storageKey) return;
  try {
    const user = await requireUser();
    // Only ever remove an object under the caller's own prefix.
    if (!isOwnedBudgetKey(storageKey, user.id)) return;
    await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).remove([storageKey]);
  } catch (error) {
    console.error("discardBudgetUpload failed", error);
  }
}

/**
 * Saves an OCR upload batch: records a `budget_uploads` row pointing at the
 * already-uploaded original file and inserts the reviewed transactions linked to
 * it via `upload_id`. Because that FK cascades, deleting the upload later removes
 * the whole batch. On partial failure the file object and upload row are cleaned
 * up so a retry starts clean.
 */
export async function saveUploadedTransactions(
  formData: FormData
): Promise<{ created: number }> {
  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    throw new Error("saveUploadedTransactions: missing payload");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    throw new Error("saveUploadedTransactions: payload is not valid JSON");
  }
  const { drafts, storageKey, fileName, mime, size } =
    saveBatchSchema.parse(payload);
  if (drafts.length === 0) return { created: 0 };

  // A client-supplied storageKey must live under the caller's own prefix, so the
  // admin-client rollback removes below can never touch another user's object.
  const user = await requireUser();
  if (storageKey && !isOwnedBudgetKey(storageKey, user.id)) {
    throw new Error("saveUploadedTransactions: storage key not owned by caller");
  }

  const rows = drafts.map(toRow);
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  const sb = await getSupabaseServer();

  // Record the upload batch.
  const { data: upload, error: upErr } = await sb
    .from("budget_uploads")
    .insert({
      file_name: fileName,
      mime,
      size,
      storage_key: storageKey,
      txn_count: rows.length,
      total_amount: totalAmount,
    })
    .select("id")
    .single();
  if (upErr || !upload) {
    if (storageKey) {
      await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).remove([storageKey]);
    }
    throw new Error(
      `saveUploadedTransactions (upload): ${upErr?.message ?? "insert failed"}`
    );
  }

  // Insert the transactions linked to the batch.
  const uploadId = (upload as { id: string }).id;
  const { error: txErr } = await sb
    .from("budget_transactions")
    .insert(rows.map((r) => ({ ...r, upload_id: uploadId })));
  if (txErr) {
    // Roll the batch back: drop the upload row (cascade — no txns yet) + file.
    await sb.from("budget_uploads").delete().eq("id", uploadId);
    if (storageKey) {
      await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).remove([storageKey]);
    }
    throw new Error(`saveUploadedTransactions (transactions): ${txErr.message}`);
  }

  revalidate();
  return { created: rows.length };
}

/**
 * Deletes an upload batch: removes the `budget_uploads` row (which cascades to
 * every transaction created from it) and the stored file. The one-step "undo"
 * for a file upload.
 */
export async function deleteUpload(uploadId: string): Promise<void> {
  z.string().uuid().parse(uploadId);
  const sb = await getSupabaseServer();

  const { data: upload, error: readErr } = await sb
    .from("budget_uploads")
    .select("storage_key")
    .eq("id", uploadId)
    .maybeSingle();
  if (readErr) throw new Error(`deleteUpload (read): ${readErr.message}`);
  if (!upload) return;

  const { error: delErr } = await sb
    .from("budget_uploads")
    .delete()
    .eq("id", uploadId);
  if (delErr) throw new Error(`deleteUpload: ${delErr.message}`);

  const storageKey = (upload as { storage_key: string | null }).storage_key;
  if (storageKey) {
    await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).remove([storageKey]);
  }

  revalidate();
}

/** Updates a single transaction in place (Ledger click-to-edit). */
export async function updateTransaction(
  id: string,
  draft: DraftTransaction
): Promise<void> {
  z.string().uuid().parse(id);
  const parsed = draftSchema.parse(draft);
  const row = toRow(parsed);

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("budget_transactions")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(`updateTransaction: ${error.message}`);

  revalidate();
}

/** Permanently deletes the given transactions (Ledger multi-select). */
export async function deleteTransactions(ids: string[]): Promise<void> {
  const parsed = z.array(z.string().uuid()).parse(ids);
  if (parsed.length === 0) return;

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("budget_transactions")
    .delete()
    .in("id", parsed);
  if (error) throw new Error(`deleteTransactions: ${error.message}`);

  revalidate();
}
