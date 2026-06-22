import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/inventory/status-badge";
import type { InventoryItem } from "@/lib/inventory/inventory";

const numberFormatter = new Intl.NumberFormat("en-US");

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const unitCostFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function InventoryTable({
  items,
  onRowClick,
}: {
  items: InventoryItem[];
  onRowClick?: (item: InventoryItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="h-24 text-center text-muted-foreground"
              >
                No inventory to display.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className="cursor-pointer [&>td]:py-4"
              >
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.category}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(item.quantity)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.unit}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.location}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {unitCostFormatter.format(item.unitCost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(item.quantity * item.unitCost)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={item.status} />
                  </div>
                </TableCell>
                <TableCell className="max-w-xs text-muted-foreground">
                  {item.description}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
