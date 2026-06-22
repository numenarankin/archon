"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { WellFinancialSummary } from "@/lib/accounting/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type SortKey = keyof Pick<
  WellFinancialSummary,
  "wellName" | "netRevenue" | "expenses" | "grossProfit"
>;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "wellName", label: "Well", numeric: false },
  { key: "netRevenue", label: "Net Revenue", numeric: true },
  { key: "expenses", label: "Expenses", numeric: true },
  { key: "grossProfit", label: "Cash Flow", numeric: true },
];

export function WellFinancialsTable({
  wells,
}: {
  wells: WellFinancialSummary[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("wellName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Names default to A→Z; figures default to highest first.
      setSortDir(key === "wellName" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...wells].sort((a, b) => {
      if (sortKey === "wellName") {
        return a.wellName.localeCompare(b.wellName) * factor;
      }
      return (a[sortKey] - b[sortKey]) * factor;
    });
  }, [wells, sortKey, sortDir]);

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={col.numeric ? "text-right" : undefined}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
                    col.numeric && "flex-row-reverse",
                    sortKey === col.key && "text-foreground"
                  )}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length}
                className="h-24 text-center text-muted-foreground"
              >
                No financial data to display.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((well) => (
              <TableRow
                key={well.wellId}
                onClick={() => router.push(`/accounting/${well.wellId}`)}
                className="cursor-pointer [&>td]:py-4"
              >
                <TableCell className="font-medium">{well.wellName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(well.netRevenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(well.expenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    well.grossProfit < 0
                      ? "text-destructive"
                      : "text-foreground"
                  )}
                >
                  {currencyFormatter.format(well.grossProfit)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <ChevronsUpDown className="size-3.5 opacity-50" />;
  }
  return dir === "asc" ? (
    <ChevronUp className="size-3.5" />
  ) : (
    <ChevronDown className="size-3.5" />
  );
}
