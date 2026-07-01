"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BdProfileModal } from "@/components/numena/bd-profile-modal";
import type { BusinessDeveloper } from "@/lib/numena/prospecting";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  // Calendar dates are stored at UTC midnight; format in UTC so they don't
  // shift a day back in negative-offset local timezones.
  timeZone: "UTC",
});

function formatCapital(amount: number | null): string {
  if (amount == null) return "—";
  return currencyFormatter.format(amount);
}

function formatLastDeal(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function BdsTable({ bds }: { bds: BusinessDeveloper[] }) {
  const [selected, setSelected] = useState<BusinessDeveloper | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Firm</TableHead>
              <TableHead>CRD</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Deals 24mo</TableHead>
              <TableHead className="text-right">506(c)</TableHead>
              <TableHead className="text-right">Capital Placed</TableHead>
              <TableHead className="text-right">Last Deal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bds.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No business developers to display.
                </TableCell>
              </TableRow>
            ) : (
              bds.map((b) => (
                <TableRow key={b.id} className="[&>td]:py-4">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => setSelected(b)}
                      title={b.name}
                      className="block max-w-[240px] truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {b.name}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {b.crd ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.location}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {numberFormatter.format(b.deals24mo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {numberFormatter.format(b.deals506c24mo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCapital(b.capitalPlaced24mo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatLastDeal(b.lastDealAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BdProfileModal
        open={selected !== null}
        firmId={selected?.id ?? null}
        firmName={selected?.name ?? ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
