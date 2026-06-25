"use client";

import { useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/budgeting/transaction-form";
import {
  createBudgetUploadTarget,
  discardBudgetUpload,
  saveUploadedTransactions,
} from "@/lib/budgeting/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { emptyDraft } from "@/lib/budgeting/derive";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/budgeting/categories";
import type { DraftTransaction } from "@/lib/budgeting/types";

const ACCEPT = ".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp";

type Status = "idle" | "extracting" | "ready" | "error";

/** Pointer to the source file already streamed direct-to-Storage by the browser. */
interface UploadRef {
  storageKey: string;
  fileName: string;
  mime: string | null;
  size: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parse a response body as JSON, returning null when the body is not JSON (e.g.
 * a 413 from the platform, or a 504/HTML gateway page on timeout) so the caller
 * surfaces a usable error instead of an opaque SyntaxError.
 */
async function readJson(
  res: Response
): Promise<{ error?: string; transactions?: Partial<DraftTransaction>[] } | null> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** A user-facing error message for a failed/non-JSON extract response. */
function messageForResponse(
  res: Response,
  data: { error?: string } | null
): string {
  if (data?.error) return data.error;
  if (res.status === 413) {
    return "That file is too large to process. Try a smaller or compressed PDF.";
  }
  if (res.status === 504) {
    return "Reading the document timed out. Try a smaller file.";
  }
  return `Extraction failed (HTTP ${res.status}).`;
}

/** Coerces the API's loosely-typed rows into safe DraftTransactions. */
function normalizeDraft(raw: Partial<DraftTransaction>): DraftTransaction {
  const base = emptyDraft(raw.date || today());
  return {
    ...base,
    ...raw,
    kind: raw.kind === "income" ? "income" : "expense",
    amount: Number(raw.amount) || 0,
  };
}

interface UploadTransactionsModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}

/**
 * Upload a financial document (bank/card statement, receipt, PDF, image, CSV, or
 * XLSX). The file is sent to Opus 4.8 for OCR + extraction, which returns draft
 * transactions held in memory. The user reviews each via the arrows on the
 * right, edits as needed, and saves the batch to the ledger.
 */
export function UploadTransactionsModal({
  open,
  onClose,
  categories,
}: UploadTransactionsModalProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadRef | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftTransaction[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFileName(null);
    setUpload(null);
    setStatus("idle");
    setError(null);
    setDrafts([]);
    setIndex(0);
  }

  function handleClose() {
    if (saving) return;
    // The file was uploaded but never committed → drop the orphaned object.
    if (upload) void discardBudgetUpload(upload.storageKey);
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setStatus("extracting");
    setError(null);
    setDrafts([]);
    setIndex(0);
    // Replacing an earlier upload in this session → discard the old object.
    if (upload) void discardBudgetUpload(upload.storageKey);
    setUpload(null);
    try {
      // 1. Stream the file straight to private Storage via a signed upload URL.
      const target = await createBudgetUploadTarget();
      const { error: upErr } = await getSupabaseBrowser()
        .storage.from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type || undefined,
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const uploadRef: UploadRef = {
        storageKey: target.path,
        fileName: file.name,
        mime: file.type || null,
        size: file.size,
      };
      setUpload(uploadRef);

      // 2. Ask the server to OCR + extract from the stored file (reference only).
      const res = await fetch("/api/budgeting/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: uploadRef.storageKey,
          fileName: uploadRef.fileName,
        }),
      });
      const data = await readJson(res);
      if (!res.ok || !data) {
        throw new Error(messageForResponse(res, data));
      }
      const extracted: DraftTransaction[] = (data.transactions ?? []).map(
        normalizeDraft
      );
      setDrafts(extracted);
      setStatus("ready");
      if (extracted.length === 0) {
        setError("No transactions were found in this document.");
      }
    } catch (err) {
      console.error("Extraction failed", err);
      setError(err instanceof Error ? err.message : "Extraction failed");
      setStatus("error");
    }
  }

  function updateDraft(patch: Partial<DraftTransaction>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }

  function removeDraft() {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
    setIndex((i) => Math.max(0, i - 1));
  }

  function addBlankDraft() {
    setDrafts((prev) => [...prev, emptyDraft(today())]);
    setIndex(drafts.length);
  }

  async function handleSave() {
    if (drafts.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({
          drafts,
          storageKey: upload?.storageKey ?? null,
          fileName: upload?.fileName ?? "upload",
          mime: upload?.mime ?? null,
          size: upload?.size ?? null,
        })
      );
      await saveUploadedTransactions(body);
      // The stored object is now linked to the batch — clear without discarding.
      reset();
      onClose();
    } catch (err) {
      console.error("Failed to save transactions", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const current = drafts[index];

  return (
    <SwipeUpModal
      open={open}
      onClose={handleClose}
      title="Upload Statement or Receipt"
      className="h-[88vh] max-w-5xl"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Content: upload area (left) + draft editor (right), equal height. */}
        <div className="flex min-h-0 flex-1">
          {/* Left: file upload area */}
          <div className="flex w-2/5 min-w-0 flex-col border-r p-5">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-ring hover:bg-muted/40"
            >
              {status === "extracting" ? (
                <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              ) : fileName ? (
                <FileTextIcon className="size-8 text-muted-foreground" />
              ) : (
                <UploadCloudIcon className="size-8 text-muted-foreground" />
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {fileName ?? "Drop a file or click to upload"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {status === "extracting"
                    ? "Reading document…"
                    : "PDF, image, CSV, or XLSX"}
                </span>
              </div>
            </button>
          </div>

          {/* Right: transaction config / draft editor */}
          <div className="flex min-w-0 flex-1 flex-col">
            {drafts.length > 0 && current ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Previous transaction"
                      disabled={index === 0}
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <span className="min-w-24 text-center text-sm font-medium tabular-nums">
                      {index + 1} of {drafts.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next transaction"
                      disabled={index >= drafts.length - 1}
                      onClick={() =>
                        setIndex((i) => Math.min(drafts.length - 1, i + 1))
                      }
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={addBlankDraft}>
                      <PlusIcon />
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove this transaction"
                      onClick={removeDraft}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <TransactionForm
                    value={current}
                    onChange={updateDraft}
                    categories={categories}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                {status === "extracting" ? (
                  <>
                    <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Extracting transactions…
                    </p>
                  </>
                ) : (
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {error ??
                      "Upload a document to automatically extract draft transactions for review."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer spans the full modal width. */}
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <span
            className={cn(
              "text-sm",
              status === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {drafts.length > 0
              ? `${drafts.length} draft transaction${drafts.length === 1 ? "" : "s"}`
              : error}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={drafts.length === 0 || saving}
            >
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save {drafts.length > 0 ? drafts.length : ""}
            </Button>
          </div>
        </div>
      </div>
    </SwipeUpModal>
  );
}
