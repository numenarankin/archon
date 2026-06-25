"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deleteTransactions,
  updateTransaction,
} from "@/lib/budgeting/actions";
import { categoriesFor, type Category } from "@/lib/budgeting/categories";
import type {
  DraftTransaction,
  Transaction,
  TransactionKind,
} from "@/lib/budgeting/types";

const currency = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const CELL_INPUT =
  "w-full rounded bg-transparent px-1.5 py-1 outline-none placeholder:text-muted-foreground/50 focus:bg-muted focus:ring-1 focus:ring-ring";

const CELL_SELECT =
  "w-full border-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground";

/** Added-date column: show the day the row entered the ledger. */
function addedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/** Strip read-only fields, leaving the editable draft shape for persistence. */
function toDraft(t: Transaction): DraftTransaction {
  return {
    kind: t.kind,
    payee: t.payee,
    amount: t.amount,
    date: t.date,
    category: t.category,
    categoryCode: t.categoryCode,
    note: t.note,
    account: t.account,
  };
}

interface LedgerPanelProps {
  transactions: Transaction[];
  categories: Category[];
}

/**
 * Chronological ledger of every transaction. Cells are edited in place,
 * committing on blur / Enter / select change. A checkbox column allows
 * multi-select and mass delete. The Added column shows when each row entered the
 * ledger.
 */
export function LedgerPanel({ transactions, categories }: LedgerPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Chronological: oldest first, tie-broken by when the row was added.
  const sorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
      ),
    [transactions]
  );

  // Local copy so cells are controlled and edits feel instant. Re-sync whenever
  // the server sends a fresh list (after revalidation).
  const [rows, setRows] = useState<Transaction[]>(sorted);
  const [syncedFrom, setSyncedFrom] = useState(transactions);
  if (syncedFrom !== transactions) {
    setSyncedFrom(transactions);
    setRows(sorted);
  }

  // Latest rows, readable synchronously from commit handlers.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function patchRow(id: string, patch: Partial<Transaction>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** Persist a row's values. Optimistic: local state already reflects them. */
  function persist(row: Transaction) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTransaction(row.id, toDraft(row));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save edit.");
        router.refresh(); // revert to server state
      }
    });
  }

  /** Commit the row's latest values (used by text/date/amount blur). */
  function commit(id: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (row) persist(row);
  }

  function setKind(id: string, kind: TransactionKind) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    const patch: Partial<Transaction> = { kind, category: "", categoryCode: "" };
    patchRow(id, patch);
    persist({ ...row, ...patch });
  }

  function setCategory(id: string, code: string, kind: TransactionKind) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    const match = categoriesFor(categories, kind).find((c) => c.code === code);
    const patch = { categoryCode: code, category: match?.label ?? "" };
    patchRow(id, patch);
    persist({ ...row, ...patch });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))
    );
  }

  function handleDelete() {
    if (selected.size === 0 || pending) return;
    const ids = [...selected];
    setError(null);
    startDelete(async () => {
      try {
        await deleteTransactions(ids);
        setSelected(new Set());
        setConfirming(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} selected`
            : `${rows.length} transactions`}
        </span>
        {selected.size > 0 &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Delete {selected.size}? This can&apos;t be undone.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending && <Loader2Icon className="animate-spin" />}
                Confirm delete
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              <Trash2Icon />
              Delete selected
            </Button>
          ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 cursor-pointer accent-primary"
                />
              </TableHead>
              <TableHead className="w-40">Date</TableHead>
              <TableHead className="w-28">Type</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead className="w-48">Category</TableHead>
              <TableHead className="w-40">Account</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-32">Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const isSelected = selected.has(t.id);
              const kindCategories = categoriesFor(categories, t.kind);
              return (
                <TableRow
                  key={t.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="group [&>td]:py-1.5"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label="Select transaction"
                      checked={isSelected}
                      onChange={() => toggle(t.id)}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="date"
                      value={t.date}
                      onChange={(e) => patchRow(t.id, { date: e.target.value })}
                      onBlur={() => commit(t.id)}
                      onKeyDown={handleKeyDown}
                      className={cn(CELL_INPUT, "font-mono text-xs")}
                      aria-label="Date"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={t.kind}
                      onValueChange={(v) =>
                        v && setKind(t.id, v as TransactionKind)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Type"
                        className={CELL_SELECT}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <input
                      value={t.payee}
                      placeholder="—"
                      onChange={(e) => patchRow(t.id, { payee: e.target.value })}
                      onBlur={() => commit(t.id)}
                      onKeyDown={handleKeyDown}
                      className={CELL_INPUT}
                      aria-label="Payee"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={t.categoryCode}
                      onValueChange={(v) => setCategory(t.id, v ?? "", t.kind)}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Category"
                        className={CELL_SELECT}
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {kindCategories.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <input
                      value={t.account}
                      placeholder="—"
                      onChange={(e) =>
                        patchRow(t.id, { account: e.target.value })
                      }
                      onBlur={() => commit(t.id)}
                      onKeyDown={handleKeyDown}
                      className={CELL_INPUT}
                      aria-label="Account"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountInput
                      value={t.amount}
                      kind={t.kind}
                      onValue={(n) => patchRow(t.id, { amount: n })}
                      onCommit={() => commit(t.id)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {addedDate(t.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Inline amount field. Shows what's typed, normalizes on blur, and tints by
 * kind (income emerald / expense maroon) so the ledger reads at a glance.
 */
function AmountInput({
  value,
  kind,
  onValue,
  onCommit,
}: {
  value: number;
  kind: TransactionKind;
  onValue: (n: number) => void;
  onCommit: () => void;
}) {
  const display = (n: number) => (n === 0 ? "" : currency.format(n));
  const [text, setText] = useState(() => display(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(display(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label="Amount"
      className={cn(
        CELL_INPUT,
        "text-right font-mono tabular-nums",
        kind === "income"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-destructive"
      )}
      onFocus={(e) => {
        focused.current = true;
        setText(value === 0 ? "" : String(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? 0 : Number(raw);
        if (!Number.isNaN(n)) onValue(n);
      }}
      onBlur={() => {
        focused.current = false;
        setText(display(value));
        onCommit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
