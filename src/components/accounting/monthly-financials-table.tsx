import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FinancialPoint } from "@/lib/accounting/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A well's month-by-month financials, newest month first. */
export function MonthlyFinancialsTable({
  rows,
  onRowClick,
}: {
  rows: FinancialPoint[];
  /** Opens the monthly report for the clicked month. */
  onRowClick?: (row: FinancialPoint) => void;
}) {
  const sorted = [...rows].sort((a, b) => (a.month < b.month ? 1 : -1));

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Net Revenue</TableHead>
            <TableHead className="text-right">Expenses</TableHead>
            <TableHead className="text-right">Cash Flow</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No financial data to display.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row) => (
              <TableRow
                key={row.month}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "[&>td]:py-4",
                  onRowClick && "cursor-pointer"
                )}
              >
                <TableCell className="font-medium">
                  {monthFormatter.format(new Date(row.month))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(row.netRevenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(row.expenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    row.grossProfit < 0 ? "text-destructive" : "text-foreground"
                  )}
                >
                  {currencyFormatter.format(row.grossProfit)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
