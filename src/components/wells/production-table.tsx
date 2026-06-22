import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionPoint } from "@/lib/wells/wells";

const numberFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats a 24-hour `HH:MM` string as a 12-hour time, e.g. "6:00 AM". */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function ProductionTable({
  data,
  onRowClick,
}: {
  data: ProductionPoint[];
  onRowClick?: (point: ProductionPoint) => void;
}) {
  // Daily readings, newest first. Oil is stored in barrels (converted at write
  // time), so the readings are shown as-is.
  const rows = [...data].reverse();

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                No production data to display.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((point, index) => (
              <TableRow
                key={`${point.date}-${point.time}-${index}`}
                className={
                  onRowClick ? "cursor-pointer [&>td]:py-4" : "[&>td]:py-4"
                }
                onClick={onRowClick ? () => onRowClick(point) : undefined}
              >
                <TableCell className="font-medium">
                  {dateFormatter.format(new Date(point.date))}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatTime(point.time)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(point.oilProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(point.oilStock)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(point.oilSales)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(point.gasProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(point.saltWater)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
