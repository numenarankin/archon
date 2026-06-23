"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteUpload } from "@/lib/accounting/actions";
import type { AccountingUpload } from "@/lib/accounting/uploads";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

interface UploadsPanelProps {
  uploads: AccountingUpload[];
}

/**
 * Lists every file uploaded into the ledger as a batch. Removing one deletes the
 * stored file and — via the cascading `upload_id` FK — every transaction created
 * from it. This is the one-step undo for a bad import.
 */
export function UploadsPanel({ uploads }: UploadsPanelProps) {
  if (uploads.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No uploads yet. Use Add Transaction → Upload file to import a statement.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead className="w-32">Uploaded</TableHead>
            <TableHead className="w-28 text-right">Transactions</TableHead>
            <TableHead className="w-32 text-right">Total</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((u) => (
            <UploadRow key={u.id} upload={u} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UploadRow({ upload }: { upload: AccountingUpload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUpload(upload.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove.");
        setConfirming(false);
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-64 truncate">{upload.fileName || "Upload"}</span>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(upload.createdAt)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{upload.txnCount}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {currency.format(upload.totalAmount)}
      </TableCell>
      <TableCell className="text-right">
        {confirming ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="xs"
              onClick={handleRemove}
              disabled={pending}
            >
              {pending && <Loader2Icon className="animate-spin" />}
              Confirm
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
            Remove
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
