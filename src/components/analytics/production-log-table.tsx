import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionLogRow } from "@/lib/analytics/types";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats a 24-hour `HH:MM` string as a 12-hour time, e.g. "6:00 AM". */
function formatTime(time: string): string {
  if (!time) return "—";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Company-wide production log: every well's daily readings in one table, with a
 * Well column. Oil figures are already in barrels (converted per-well from gauge
 * inches in the data layer). Newest first.
 */
export function ProductionLogTable({ rows }: { rows: ProductionLogRow[] }) {
  return (
    <div className="max-h-[520px] overflow-auto rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="sticky top-0 z-10 bg-muted [&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="hover:bg-muted">
            <TableHead>Well</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right">Oil Prod (bbl)</TableHead>
            <TableHead className="text-right">Oil Stock (bbl)</TableHead>
            <TableHead className="text-right">Oil Sales (bbl)</TableHead>
            <TableHead className="text-right">Gas (MCF)</TableHead>
            <TableHead className="text-right">Salt Water</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="h-24 text-center text-muted-foreground"
              >
                No production data to display.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="[&>td]:py-3.5">
                <TableCell className="font-medium">
                  <Link
                    href={`/wells/${row.wellId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.wellName}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  {dateFormatter.format(new Date(`${row.date}T00:00:00Z`))}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatTime(row.time)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(row.oilProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(row.oilStock)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(row.oilSales)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(row.gasProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(row.saltWater)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
