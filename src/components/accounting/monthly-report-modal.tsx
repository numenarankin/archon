"use client";

import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { cn } from "@/lib/utils";
import type { MonthlyReport, Transaction } from "@/lib/accounting/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currency2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dash = (n: number | null, fmt: Intl.NumberFormat) =>
  n == null ? "—" : fmt.format(n);

/** Groups expense rows by category label, preserving first-seen order. */
function groupByCategory(rows: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    const key = row.category || "Uncategorized";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()];
}

interface MonthlyReportModalProps {
  /**
   * The report to show. The parent keeps this populated through the close
   * animation (visibility is driven by `open`), so it never flashes empty.
   */
  report: MonthlyReport | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Read-only monthly statement for a well: the revenue line (with volume/price/
 * NRI/prod-tax), expenses by category, cash flow, and the distribution of
 * revenue to each interest owner.
 */
export function MonthlyReportModal({
  report,
  open,
  onClose,
}: MonthlyReportModalProps) {
  const shown = report;

  const title = shown
    ? `${shown.wellName} — ${monthLabel.format(new Date(shown.month))}`
    : "Monthly Report";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={title}
      description="Monthly statement"
      className="h-[88vh] max-w-4xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {shown ? (
          <div className="flex flex-col gap-8">
            <RevenueSection report={shown} />
            <ExpenseSection report={shown} />
            <CashFlowLine report={shown} />
            <DistributionSection report={shown} />
          </div>
        ) : null}
      </div>
    </SwipeUpModal>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function RevenueSection({ report }: { report: MonthlyReport }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>Revenue</SectionHeading>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <table className="w-full text-[0.95rem]">
          <thead className="border-b bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <tr>
              <th className="text-left">Source</th>
              <th className="text-right">Volume</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
              <th className="text-right">WRK-1 NRI</th>
              <th className="text-right">Prod Tax</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_td]:py-2.5">
            {report.revenue.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground">
                  No revenue recorded this month.
                </td>
              </tr>
            ) : (
              report.revenue.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="font-medium">{r.category || r.counterparty}</td>
                  <td className="text-right tabular-nums">
                    {dash(r.volume, number)}
                  </td>
                  <td className="text-right tabular-nums">
                    {dash(r.price, currency2)}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.volume != null && r.price != null
                      ? currency.format(r.volume * r.price)
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {dash(r.nri, decimal)}
                  </td>
                  <td className="text-right tabular-nums">
                    {dash(r.prodTax, currency)}
                  </td>
                  <td className="text-right font-medium tabular-nums">
                    {currency.format(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t bg-muted/30 [&_td]:px-3 [&_td]:py-2.5">
            <tr>
              <td colSpan={6} className="font-medium">
                Total Revenue
              </td>
              <td className="text-right font-semibold tabular-nums">
                {currency.format(report.revenueTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ExpenseSection({ report }: { report: MonthlyReport }) {
  const groups = groupByCategory(report.expenses);
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>Expenses</SectionHeading>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <table className="w-full text-[0.95rem]">
          <thead className="border-b bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <tr>
              <th className="text-left">Category</th>
              <th className="text-left">Recipient</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_td]:py-2.5">
            {report.expenses.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted-foreground">
                  No expenses recorded this month.
                </td>
              </tr>
            ) : (
              groups.flatMap(([category, rows]) =>
                rows.map((e, i) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="font-medium text-muted-foreground">
                      {i === 0 ? category : ""}
                    </td>
                    <td>{e.counterparty || "—"}</td>
                    <td className="text-right tabular-nums">
                      {currency.format(e.amount)}
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
          <tfoot className="border-t bg-muted/30 [&_td]:px-3 [&_td]:py-2.5">
            <tr>
              <td colSpan={2} className="font-medium">
                Total Expenses
              </td>
              <td className="text-right font-semibold tabular-nums">
                {currency.format(report.expenseTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function CashFlowLine({ report }: { report: MonthlyReport }) {
  return (
    <div className="flex items-center justify-between rounded-[0.1rem] border bg-muted/30 px-4 py-3">
      <span className="font-heading text-base font-semibold tracking-tight">
        Cash Flow
      </span>
      <span
        className={cn(
          "font-heading text-base font-semibold tabular-nums",
          report.cashFlow < 0 ? "text-destructive" : "text-foreground"
        )}
      >
        {currency.format(report.cashFlow)}
      </span>
    </div>
  );
}

function DistributionSection({ report }: { report: MonthlyReport }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>Distributions to Interest Owners</SectionHeading>
      <div className="overflow-hidden rounded-[0.1rem] border">
        <table className="w-full text-[0.95rem]">
          <thead className="border-b bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <tr>
              <th className="text-left">Owner</th>
              <th className="text-left">Interest Type</th>
              <th className="text-right">Decimal Interest</th>
              <th className="text-right">Distribution</th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_td]:py-2.5">
            {report.distributions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground">
                  No interest owners on this well.
                </td>
              </tr>
            ) : (
              report.distributions.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="font-medium">{d.name}</td>
                  <td className="text-muted-foreground">{d.interestType}</td>
                  <td className="text-right tabular-nums">
                    {decimal.format(d.decimalInterest)}
                  </td>
                  <td className="text-right tabular-nums">
                    {currency.format(d.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
