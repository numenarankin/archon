import { ArrowUpRight } from "lucide-react";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DashboardCard } from "@/components/finance/dashboard-card";
import type { MercuryTransaction } from "@/lib/mercury/types";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

const STATUS_STYLES: Record<MercuryTransaction["status"], string> = {
  pending: "text-amber-600 dark:text-amber-400",
  sent: "text-muted-foreground",
  cancelled: "text-muted-foreground",
  failed: "text-destructive",
  reversed: "text-destructive",
  blocked: "text-destructive",
};

function StatusPill({ status }: { status: MercuryTransaction["status"] }) {
  if (status === "sent") return null;
  return (
    <span
      className={cn(
        "rounded-[2px] bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

interface TxnTableProps {
  title: string;
  description: string;
  transactions: MercuryTransaction[];
  limit?: number;
  /** True for money-in (tint positive amounts emerald); false for money-out. */
  isInflow: boolean;
  /** Show status pill next to counterparty when status ≠ 'sent'. */
  showStatus?: boolean;
}

function TxnTable({
  title,
  description,
  transactions,
  limit = 12,
  isInflow,
  showStatus = true,
}: TxnTableProps) {
  const rows = transactions.slice(0, limit);

  return (
    <DashboardCard className="gap-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No transactions in window.
          </p>
        ) : (
          <Table>
            <TableHeader className="[&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
              <TableRow>
                <TableHead className="w-24">Posted</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const displayName = t.counterpartyNickname ?? t.counterpartyName;
                const subText = t.externalMemo ?? t.bankDescription ?? null;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="align-top font-mono text-xs text-muted-foreground">
                      {t.postedAt ? (
                        fmtDate(t.postedAt)
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-sm text-foreground">
                          {displayName}
                          {showStatus && <StatusPill status={t.status} />}
                        </span>
                        {subText && (
                          <span className="truncate text-xs text-muted-foreground">
                            {subText}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {t.mercuryCategory ?? t.categoryName ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right align-top font-mono text-sm tabular-nums",
                        isInflow
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      )}
                    >
                      {isInflow ? "+" : "−"}
                      {fmtUSD(Math.abs(t.amount))}
                    </TableCell>
                    <TableCell className="align-top">
                      <a
                        href={t.dashboardLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Open in Mercury"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </DashboardCard>
  );
}

export function MoneyInTable({
  transactions,
}: {
  transactions: MercuryTransaction[];
}) {
  return (
    <TxnTable
      title="Money in"
      description={`Credits in last 180 days · ${transactions.length} total`}
      transactions={transactions}
      isInflow
    />
  );
}

export function MoneyOutTable({
  transactions,
}: {
  transactions: MercuryTransaction[];
}) {
  return (
    <TxnTable
      title="Money out"
      description={`Debits in last 180 days · ${transactions.length} total`}
      transactions={transactions}
      isInflow={false}
      showStatus={false}
    />
  );
}
