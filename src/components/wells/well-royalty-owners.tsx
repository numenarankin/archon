"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon, UserIcon, XIcon } from "lucide-react";
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
import type { RoyaltyOwner } from "@/lib/people/people";

const CELL_INPUT =
  "w-full rounded bg-transparent px-1.5 py-1 outline-none placeholder:text-muted-foreground/50 focus:bg-muted focus:ring-1 focus:ring-ring";

const INTEREST_TYPES: RoyaltyOwner["interestType"][] = [
  "Royalty",
  "Overriding",
  "Mineral",
];

/** Partial inline patch of an owner's editable fields. */
export interface RoyaltyOwnerEdit {
  name?: string;
  interestType?: RoyaltyOwner["interestType"];
  decimalInterest?: number;
  lastPayment?: number;
  email?: string;
  mailingAddress?: string;
}

interface WellRoyaltyOwnersPanelProps {
  owners: RoyaltyOwner[];
  /** Local edit of a field (controlled input). */
  onChange: (id: string, patch: RoyaltyOwnerEdit) => void;
  /** Persist a row after an edit (fired on blur / Enter / select change). */
  onCommit: (id: string) => void;
  /** Append a new blank owner linked to this well. */
  onAdd: () => void;
  /** Remove an owner's interest in this well. */
  onDelete: (id: string) => void;
  /** Row whose name input should grab focus (e.g. a freshly added row). */
  autoFocusId?: string | null;
}

/**
 * Inline-editable royalty owners for a single well, mirroring the equipment
 * tab's edit model. Edits write the shared `royalty_owners` record; removing an
 * owner here only unlinks them from this well (they remain on the People page).
 */
export function WellRoyaltyOwnersPanel({
  owners,
  onChange,
  onCommit,
  onAdd,
  onDelete,
  autoFocusId,
}: WellRoyaltyOwnersPanelProps) {
  // Enter commits by blurring; the blur handler does the persist.
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Interest Type</TableHead>
              <TableHead className="text-right">Decimal Interest</TableHead>
              <TableHead className="text-right">Last Payment</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mailing Address</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No royalty owners for this well.
                </TableCell>
              </TableRow>
            ) : (
              owners.map((o) => (
                <TableRow key={o.id} className="group [&>td]:py-2">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                      <input
                        value={o.name}
                        placeholder="Owner name"
                        autoFocus={autoFocusId === o.id}
                        onChange={(e) =>
                          onChange(o.id, { name: e.target.value })
                        }
                        onBlur={() => onCommit(o.id)}
                        onKeyDown={handleKeyDown}
                        className={`${CELL_INPUT} font-medium`}
                        aria-label="Owner name"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={o.interestType}
                      onValueChange={(v) => {
                        onChange(o.id, {
                          interestType: v as RoyaltyOwner["interestType"],
                        });
                        onCommit(o.id);
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Interest type"
                        className="w-full border-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTEREST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <NumericInput
                      value={o.decimalInterest}
                      onValue={(n) =>
                        onChange(o.id, { decimalInterest: n })
                      }
                      onCommit={() => onCommit(o.id)}
                      ariaLabel="Decimal interest"
                      className={`${CELL_INPUT} text-right tabular-nums`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumericInput
                      value={o.lastPayment}
                      onValue={(n) => onChange(o.id, { lastPayment: n })}
                      onCommit={() => onCommit(o.id)}
                      ariaLabel="Last payment"
                      className={`${CELL_INPUT} text-right tabular-nums`}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="email"
                      value={o.email}
                      placeholder="—"
                      onChange={(e) =>
                        onChange(o.id, { email: e.target.value })
                      }
                      onBlur={() => onCommit(o.id)}
                      onKeyDown={handleKeyDown}
                      className={`${CELL_INPUT} text-muted-foreground focus:text-foreground`}
                      aria-label="Email"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      value={o.mailingAddress}
                      placeholder="—"
                      onChange={(e) =>
                        onChange(o.id, { mailingAddress: e.target.value })
                      }
                      onBlur={() => onCommit(o.id)}
                      onKeyDown={handleKeyDown}
                      className={`${CELL_INPUT} text-muted-foreground focus:text-foreground`}
                      aria-label="Mailing address"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${o.name || "owner"} from this well`}
                      onClick={() => onDelete(o.id)}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <XIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onAdd}
      >
        <PlusIcon />
        Add Royalty Owner
      </Button>
    </div>
  );
}

/**
 * Plain-text numeric field (no spinner arrows). Shows exactly what's typed and
 * renders empty for a zero value, so input isn't prefixed with a stray "0". The
 * numeric value is bubbled up live; the display normalizes on blur.
 */
function NumericInput({
  value,
  onValue,
  onCommit,
  ariaLabel,
  className,
}: {
  value: number;
  onValue: (n: number) => void;
  onCommit: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const display = (n: number) => (n === 0 ? "" : String(n));
  const [text, setText] = useState(() => display(value));
  const focused = useRef(false);

  // Reflect external changes (e.g. a reset row), but never while the user types.
  useEffect(() => {
    if (!focused.current) setText(display(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={ariaLabel}
      className={className}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Accept only number-ish text (digits, one dot, optional leading minus).
        if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "-" || raw === "." ? 0 : Number(raw);
        if (!Number.isNaN(n)) onValue(n);
      }}
      onBlur={() => {
        focused.current = false;
        setText(display(value)); // normalize "01" → "1", "" for 0
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
