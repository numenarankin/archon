"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categoriesFor, type Category } from "@/lib/accounting/categories";
import type { DraftTransaction, TransactionKind } from "@/lib/accounting/types";

export interface WellOption {
  id: string;
  name: string;
}

const FIELD =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface TransactionFormProps {
  value: DraftTransaction;
  onChange: (patch: Partial<DraftTransaction>) => void;
  wells: WellOption[];
  /** The org's chart of accounts (drives the category dropdown). */
  categories: Category[];
}

/**
 * The editable fields of a single transaction. Used standalone (manual entry)
 * and inside the OCR draft editor. Revenue-only fields (volume, price, prod
 * tax, NRI) are shown only when the kind is "revenue".
 */
export function TransactionForm({
  value,
  onChange,
  wells,
  categories,
}: TransactionFormProps) {
  const kindCategories = categoriesFor(categories, value.kind);
  const isRevenue = value.kind === "revenue";

  // Switching kind clears the category (its options change) and the
  // revenue-only fields when moving to an expense.
  function setKind(kind: TransactionKind) {
    onChange(
      kind === "expense"
        ? {
            kind,
            category: "",
            categoryCode: "",
            volume: null,
            price: null,
            prodTax: null,
            nri: null,
          }
        : { kind, category: "", categoryCode: "" }
    );
  }

  function setCategory(code: string | null) {
    const match = kindCategories.find((c) => c.code === code);
    onChange({ categoryCode: code ?? "", category: match?.label ?? "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={value.kind} onValueChange={(v) => setKind(v as TransactionKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
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

      <Field label={isRevenue ? "Payer" : "Recipient"}>
        <input
          value={value.counterparty}
          onChange={(e) => onChange({ counterparty: e.target.value })}
          placeholder={isRevenue ? "e.g. Plains Marketing" : "e.g. ABC Pumping"}
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
        <Field label="Well">
          <Select
            value={value.wellId}
            onValueChange={(v) => onChange({ wellId: v ?? "" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select well" />
            </SelectTrigger>
            <SelectContent>
              {wells.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={isRevenue ? "Net Amount ($)" : "Amount ($)"}>
          <NumberField
            value={value.amount}
            onValue={(n) => onChange({ amount: n ?? 0 })}
          />
        </Field>
        <Field label="Invoice #">
          <input
            value={value.invoiceNumber}
            onChange={(e) => onChange({ invoiceNumber: e.target.value })}
            placeholder="—"
            className={FIELD}
          />
        </Field>
      </div>

      {isRevenue ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Volume">
            <NumberField
              value={value.volume}
              onValue={(n) => onChange({ volume: n })}
            />
          </Field>
          <Field label="Price ($)">
            <NumberField
              value={value.price}
              onValue={(n) => onChange({ price: n })}
            />
          </Field>
          <Field label="WRK-1 NRI">
            <NumberField
              value={value.nri}
              onValue={(n) => onChange({ nri: n })}
            />
          </Field>
          <Field label="Prod Tax ($)">
            <NumberField
              value={value.prodTax}
              onValue={(n) => onChange({ prodTax: n })}
            />
          </Field>
        </div>
      ) : null}
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
