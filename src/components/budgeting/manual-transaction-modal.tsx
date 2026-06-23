"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Button } from "@/components/ui/button";
import {
  TransactionForm,
  type WellOption,
} from "@/components/accounting/transaction-form";
import { createTransactions } from "@/lib/accounting/actions";
import { emptyDraft } from "@/lib/accounting/derive";
import type { Category } from "@/lib/accounting/categories";
import type { DraftTransaction } from "@/lib/accounting/types";

/** Today as an ISO `YYYY-MM-DD` in local time. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ManualTransactionModalProps {
  open: boolean;
  onClose: () => void;
  wells: WellOption[];
  categories: Category[];
}

/** Single-transaction manual entry form in a modal. */
export function ManualTransactionModal({
  open,
  onClose,
  wells,
  categories,
}: ManualTransactionModalProps) {
  const [draft, setDraft] = useState<DraftTransaction>(() =>
    emptyDraft(today())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = draft.amount > 0 && draft.date !== "" && draft.wellId !== "";

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createTransactions([draft]);
      setDraft(emptyDraft(today()));
      onClose();
    } catch (err) {
      console.error("Failed to save transaction", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Add Transaction"
      description="Manually record a revenue or expense entry."
      className="max-w-xl"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        <TransactionForm
          value={draft}
          onChange={(p) => setDraft({ ...draft, ...p })}
          wells={wells}
          categories={categories}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
        <span className="text-sm text-destructive">{error}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </SwipeUpModal>
  );
}
