"use client";

import { useMemo, useState } from "react";
import { FinancialChart } from "@/components/accounting/financial-chart";
import { MonthlyFinancialsTable } from "@/components/accounting/monthly-financials-table";
import { MonthlyReportModal } from "@/components/accounting/monthly-report-modal";
import {
  aggregateMonthly,
  buildMonthlyReport,
  type InterestOwner,
} from "@/lib/accounting/derive";
import type { Transaction } from "@/lib/accounting/types";

interface WellAccountingWorkspaceProps {
  wellId: string;
  wellName: string;
  transactions: Transaction[];
  owners: InterestOwner[];
}

/**
 * Per-well accounting breakdown: the same financial-performance chart as the
 * overview, plus a month-by-month table going back as far as data exists.
 * Clicking a month opens the read-only monthly report.
 */
export function WellAccountingWorkspace({
  wellId,
  wellName,
  transactions,
  owners,
}: WellAccountingWorkspaceProps) {
  // `reportMonth` is retained after close (so the modal doesn't flash empty
  // mid-animation); `reportOpen` drives visibility.
  const [reportMonth, setReportMonth] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const series = useMemo(
    () => aggregateMonthly(transactions),
    [transactions]
  );

  const report = useMemo(
    () =>
      reportMonth
        ? buildMonthlyReport(wellId, wellName, reportMonth, transactions, owners)
        : null,
    [reportMonth, wellId, wellName, transactions, owners]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {wellName}
      </h1>

      <FinancialChart data={series} />

      <MonthlyFinancialsTable
        rows={series}
        onRowClick={(row) => {
          setReportMonth(row.month);
          setReportOpen(true);
        }}
      />

      <MonthlyReportModal
        report={report}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
