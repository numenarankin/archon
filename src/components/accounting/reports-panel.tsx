"use client";

import { useMemo, useState } from "react";
import { EyeIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MonthlyReportModal } from "@/components/accounting/monthly-report-modal";
import { SummaryReportModal } from "@/components/accounting/summary-report-modal";
import type { WellOption } from "@/components/accounting/transaction-form";
import {
  buildMonthlyReport,
  monthKey,
  summarizeByWell,
  type InterestOwner,
} from "@/lib/accounting/derive";
import type {
  MonthlyReport,
  MonthlySummary,
  Transaction,
} from "@/lib/accounting/types";

type ReportType = "summary" | "well";

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "well", label: "Well Reports" },
];

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

/** A single browsable report row (well statement or company summary). */
interface ReportRow {
  key: string;
  title: string;
  type: string;
  wellId: string | null;
  wellLabel: string;
  month: string;
  cashFlow: number;
}

interface ReportsPanelProps {
  transactions: Transaction[];
  wells: WellOption[];
  ownersByWell: Record<string, InterestOwner[]>;
}

/**
 * The Reports tab: a Summary / Well Reports toggle, well + period filters, and a
 * files-style table of statements. Each row opens its read-only report.
 */
export function ReportsPanel({
  transactions,
  wells,
  ownersByWell,
}: ReportsPanelProps) {
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [wellFilter, setWellFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const [wellReport, setWellReport] = useState<MonthlyReport | null>(null);
  const [wellOpen, setWellOpen] = useState(false);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Distinct months present in the ledger, newest first.
  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date)));
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  // One report per (well, month) that has activity.
  const wellReports = useMemo<ReportRow[]>(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!t.wellId) continue;
      const key = `${t.wellId}|${monthKey(t.date)}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()]
      .map(([key, txns]) => {
        const cashFlow = txns.reduce(
          (sum, t) => sum + (t.kind === "revenue" ? t.amount : -t.amount),
          0
        );
        return {
          key,
          title: `${txns[0].wellName} Statement`,
          type: "Well Statement",
          wellId: txns[0].wellId,
          wellLabel: txns[0].wellName,
          month: monthKey(txns[0].date),
          cashFlow,
        };
      })
      .sort((a, b) =>
        a.month === b.month
          ? a.wellLabel.localeCompare(b.wellLabel)
          : a.month < b.month
            ? 1
            : -1
      );
  }, [transactions]);

  // One company-wide summary per month.
  const summaryReports = useMemo<ReportRow[]>(() => {
    return months.map((month) => {
      const monthTxns = transactions.filter((t) => monthKey(t.date) === month);
      const cashFlow = monthTxns.reduce(
        (sum, t) => sum + (t.kind === "revenue" ? t.amount : -t.amount),
        0
      );
      return {
        key: `summary|${month}`,
        title: "Company Summary",
        type: "Summary",
        wellId: null,
        wellLabel: "All wells",
        month,
        cashFlow,
      };
    });
  }, [months, transactions]);

  const rows = useMemo(() => {
    const base = reportType === "well" ? wellReports : summaryReports;
    return base.filter((r) => {
      if (monthFilter !== "all" && r.month !== monthFilter) return false;
      if (reportType === "well" && wellFilter !== "all" && r.wellId !== wellFilter) {
        return false;
      }
      return true;
    });
  }, [reportType, wellReports, summaryReports, monthFilter, wellFilter]);

  function openRow(row: ReportRow) {
    if (reportType === "well" && row.wellId) {
      const wellTxns = transactions.filter(
        (t) => t.wellId === row.wellId && monthKey(t.date) === row.month
      );
      setWellReport(
        buildMonthlyReport(
          row.wellId,
          row.wellLabel,
          row.month,
          wellTxns,
          ownersByWell[row.wellId] ?? []
        )
      );
      setWellOpen(true);
      return;
    }
    const monthTxns = transactions.filter((t) => monthKey(t.date) === row.month);
    const revenueTotal = monthTxns
      .filter((t) => t.kind === "revenue")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = monthTxns
      .filter((t) => t.kind === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    setSummary({
      month: row.month,
      perWell: summarizeByWell(monthTxns),
      revenueTotal,
      expenseTotal,
      cashFlow: revenueTotal - expenseTotal,
    });
    setSummaryOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: report-type toggle + filters. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Report type"
          className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5"
        >
          {REPORT_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={reportType === t.key}
              onClick={() => setReportType(t.key)}
              className={cn(
                "rounded-[min(var(--radius-md),10px)] px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                reportType === t.key &&
                  "bg-background text-foreground shadow-sm hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={wellFilter}
            onValueChange={(v) => setWellFilter(v ?? "all")}
            disabled={reportType === "summary"}
          >
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue>
                {(value) =>
                  value === "all"
                    ? "All wells"
                    : (wells.find((w) => w.id === value)?.name ?? "All wells")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wells</SelectItem>
              {wells.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue>
                {(value) =>
                  value === "all"
                    ? "All periods"
                    : monthLabel.format(new Date(value as string))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel.format(new Date(m))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Files-style report table. */}
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Report</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Well</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Cash Flow</TableHead>
              <TableHead className="text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No reports match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key} className="[&>td]:py-4">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => openRow(row)}
                      className="flex items-center gap-2.5 text-left transition-colors hover:text-foreground hover:underline"
                    >
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      {row.title}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.type}
                  </TableCell>
                  <TableCell>{row.wellLabel}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {monthLabel.format(new Date(row.month))}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      row.cashFlow < 0 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {currency.format(row.cashFlow)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View ${row.title}`}
                      onClick={() => openRow(row)}
                    >
                      <EyeIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MonthlyReportModal
        report={wellReport}
        open={wellOpen}
        onClose={() => setWellOpen(false)}
      />
      <SummaryReportModal
        summary={summary}
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
      />
    </div>
  );
}
