"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categoriesFor, type Category } from "@/lib/budgeting/categories";
import type { DraftTransaction, TransactionKind } from "@/lib/budgeting/types";

const FIELD =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface TransactionFormProps {
  value: DraftTransaction;
  onChange: (patch: Partial<DraftTransaction>) => void;
  /** The budget category list (drives the category dropdown). */
  categories: Category[];
}

/**
 * The editable fields of a single transaction. Used standalone (manual entry)
 * and inside the OCR draft editor.
 */
export function TransactionForm({
  value,
  onChange,
  categories,
}: TransactionFormProps) {
  const kindCategories = categoriesFor(categories, value.kind);
  const isIncome = value.kind === "income";

  // Switching kind clears the category (its options change).
  function setKind(kind: TransactionKind) {
    onChange({ kind, category: "", categoryCode: "" });
  }

  function setCategory(code: string | null) {
    const match = kindCategories.find((c) => c.code === code);
    onChange({ categoryCode: code ?? "", category: match?.label ?? "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select
            value={value.kind}
            onValueChange={(v) => setKind(v as TransactionKind)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={value.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className={FIELD}
          />
        </Field>
      </div>

      <Field label={isIncome ? "Source" : "Payee / Merchant"}>
        <input
          value={value.payee}
          onChange={(e) => onChange({ payee: e.target.value })}
          placeholder={isIncome ? "e.g. Acme Payroll" : "e.g. Whole Foods"}
          className={FIELD}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={value.categoryCode} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {kindCategories.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Account">
          <input
            value={value.account}
            onChange={(e) => onChange({ account: e.target.value })}
            placeholder="e.g. Checking"
            className={FIELD}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)">
          <NumberField
            value={value.amount}
            onValue={(n) => onChange({ amount: n ?? 0 })}
          />
        </Field>
        <Field label="Note">
          <input
            value={value.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="—"
            className={FIELD}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Controlled numeric input. Empty maps to null (so optional fields can be blank)
 * unless the caller coerces null to 0. Accepts only number-ish text.
 */
function NumberField({
  value,
  onValue,
  className,
}: {
  value: number | null;
  onValue: (n: number | null) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value == null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
        if (raw === "" || raw === "-" || raw === ".") {
          onValue(null);
          return;
        }
        const n = Number(raw);
        if (!Number.isNaN(n)) onValue(n);
      }}
      placeholder="—"
      className={cn(FIELD, "text-right tabular-nums", className)}
    />
  );
}
