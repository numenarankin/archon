"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CommodityMeta, PricePoint } from "@/lib/pricing/types";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});

interface PostedPriceTableProps {
  rows: PricePoint[];
  meta: CommodityMeta;
}

/**
 * The posted-price series is flat within each (production) month, so collapse
 * the daily points to one row per month for display.
 */
function toMonthlyRows(rows: PricePoint[]): { month: string; price: number }[] {
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.date.slice(0, 7), r.price);
  return [...byMonth.entries()]
    .map(([month, price]) => ({ month, price }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** Posted prices the org received (most recent first). Benchmark stays on the chart. */
export function PostedPriceTable({ rows, meta }: PostedPriceTableProps) {
  const sorted = toMonthlyRows(rows);

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Month</TableHead>
            <TableHead className="text-right">
              Posted Price (${meta.unit})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="h-24 text-center text-muted-foreground"
              >
                No posted prices yet for {meta.label.toLowerCase()}.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row) => (
              <TableRow key={row.month} className="[&>td]:py-4">
                <TableCell className="font-medium">
                  {monthFormatter.format(new Date(`${row.month}-01T00:00:00Z`))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${row.price.toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
