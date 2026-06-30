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
import { IssuerProfileModal } from "@/components/numena/issuer-profile-modal";
import type { Filing } from "@/lib/numena/prospecting";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatOffering(amount: number | null): string {
  if (amount == null) return "—";
  return currencyFormatter.format(amount);
}

function formatFiledAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function FilingsTable({ filings }: { filings: Filing[] }) {
  const [selected, setSelected] = useState<Filing | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Issuer</TableHead>
              <TableHead>Form</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Exemption</TableHead>
              <TableHead className="text-right">Offering</TableHead>
              <TableHead className="text-right">Filed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No filings to display.
                </TableCell>
              </TableRow>
            ) : (
              filings.map((f) => (
                <TableRow key={f.id} className="[&>td]:py-4">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => setSelected(f)}
                      title={f.issuer}
                      className="block max-w-[240px] truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {f.issuer}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {f.formType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.industry}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.exemption}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatOffering(f.offeringAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatFiledAt(f.filedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <IssuerProfileModal
        open={selected !== null}
        accessionNo={selected?.id ?? null}
        issuerName={selected?.issuer ?? ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
