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
import { OperatorProfileModal } from "@/components/wildcat/operator-profile-modal";
import type { OperatorPoint } from "@/lib/wells/queries";

const numberFormatter = new Intl.NumberFormat("en-US");

function location(op: OperatorPoint): string {
  return [op.c, op.s].filter(Boolean).join(", ") || "—";
}

export function OperatorsTable({ operators }: { operators: OperatorPoint[] }) {
  const [selected, setSelected] = useState<OperatorPoint | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Operator</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="font-mono">ZIP</TableHead>
              <TableHead className="text-right">Wells</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operators.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No operators to display.
                </TableCell>
              </TableRow>
            ) : (
              operators.map((op) => (
                <TableRow key={op.n} className="[&>td]:py-4">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => setSelected(op)}
                      title={op.nm}
                      className="block max-w-[280px] truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {op.nm}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {location(op)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {op.z || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {numberFormatter.format(op.w)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OperatorProfileModal
        open={selected !== null}
        operatorNumber={selected?.n ?? null}
        operatorName={selected?.nm ?? ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
