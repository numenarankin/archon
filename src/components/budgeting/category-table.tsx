"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CategorySummary } from "@/lib/budgeting/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface CategoryTableProps {
  categories: CategorySummary[];
}

/**
 * Per-category totals over the available period — the overview's "where the
 * money goes" table. Income and expense categories are listed together, largest
 * total first, and tinted by kind so spending reads at a glance.
 */
export function CategoryTable({ categories }: CategoryTableProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No transactions yet. Add one to see your spending by category.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader className="[&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Category</TableHead>
            <TableHead className="w-28">Type</TableHead>
            <TableHead className="w-36 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c) => (
            <TableRow key={`${c.kind}:${c.categoryCode}`}>
              <TableCell className="font-medium">{c.category}</TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {c.kind}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono tabular-nums",
                  c.kind === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                )}
              >
                {currency.format(c.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
