"use client";

import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MonthlySummary } from "@/lib/accounting/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

interface SummaryReportModalProps {
  summary: MonthlySummary | null;
  open: boolean;
  onClose: () => void;
}

/** Read-only company-wide monthly summary: totals + a per-well breakdown. */
export function SummaryReportModal({
  summary,
  open,
  onClose,
}: SummaryReportModalProps) {
  const title = summary
    ? `Company Summary — ${monthLabel.format(new Date(summary.month))}`
    : "Company Summary";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={title}
      className="h-[88vh] max-w-4xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {summary ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Net Revenue" value={currency.format(summary.revenueTotal)} />
              <Stat label="Expenses" value={currency.format(summary.expenseTotal)} />
              <Stat
                label="Cash Flow"
                value={currency.format(summary.cashFlow)}
                negative={summary.cashFlow < 0}
              />
            </div>

            <div className="overflow-hidden rounded-[0.1rem] border">
              <Table className="text-[0.95rem]">
                <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Well</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Cash Flow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.perWell.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No activity this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.perWell.map((w) => (
                      <TableRow key={w.wellId} className="[&>td]:py-4">
                        <TableCell className="font-medium">{w.wellName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency.format(w.netRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency.format(w.expenses)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            w.grossProfit < 0
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {currency.format(w.grossProfit)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>
    </SwipeUpModal>
  );
}

function Stat({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[0.1rem] border bg-muted/30 px-4 py-3">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-lg font-semibold tabular-nums",
          negative ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
