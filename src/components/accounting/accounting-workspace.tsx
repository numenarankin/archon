"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FinancialChart } from "@/components/accounting/financial-chart";
import { WellFinancialsTable } from "@/components/accounting/well-financials-table";
import { ReportsPanel } from "@/components/accounting/reports-panel";
import { LedgerPanel } from "@/components/accounting/ledger-panel";
import { UploadsPanel } from "@/components/accounting/uploads-panel";
import { ManualTransactionModal } from "@/components/accounting/manual-transaction-modal";
import { UploadTransactionsModal } from "@/components/accounting/upload-transactions-modal";
import type { WellOption } from "@/components/accounting/transaction-form";
import {
  aggregateMonthly,
  summarizeByWell,
  type InterestOwner,
} from "@/lib/accounting/derive";
import type { Category } from "@/lib/accounting/categories";
import type { Transaction } from "@/lib/accounting/types";
import type { AccountingUpload } from "@/lib/accounting/uploads";

type Tab = "overview" | "reports" | "ledger" | "uploads";

interface AccountingWorkspaceProps {
  transactions: Transaction[];
  wells: WellOption[];
  /** Interest owners keyed by well id, for monthly report distributions. */
  ownersByWell: Record<string, InterestOwner[]>;
  /** The org's chart of accounts, for the Add Transaction forms. */
  categories: Category[];
  /** Upload batches, for the Uploads tab. */
  uploads: AccountingUpload[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "reports", label: "Reports" },
  { key: "ledger", label: "Ledger" },
  { key: "uploads", label: "Uploads" },
];

/**
 * The /accounting page: an Overview tab (aggregate chart + sortable per-well
 * table) and a Reports tab (browsable, filterable statements). An Add
 * Transaction action sits on the right of the header menu.
 */
export function AccountingWorkspace({
  transactions,
  wells,
  ownersByWell,
  categories,
  uploads,
}: AccountingWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<"manual" | "upload" | null>(null);

  const series = useMemo(
    () => aggregateMonthly(transactions),
    [transactions]
  );
  const wellSummaries = useMemo(
    () => summarizeByWell(transactions),
    [transactions]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header menu (Pricing-style tabs) + Add Transaction. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "font-heading text-2xl font-semibold tracking-tight transition-colors",
                tab === t.key
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="lg" />}>
            <PlusIcon />
            Add Transaction
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setModal("manual")}
            >
              Add manually
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setModal("upload")}
            >
              Upload file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tab === "overview" && (
        <>
          <FinancialChart data={series} />
          <WellFinancialsTable wells={wellSummaries} />
        </>
      )}
      {tab === "reports" && (
        <ReportsPanel
          transactions={transactions}
          wells={wells}
          ownersByWell={ownersByWell}
        />
      )}
      {tab === "ledger" && (
        <LedgerPanel
          transactions={transactions}
          wells={wells}
          categories={categories}
        />
      )}
      {tab === "uploads" && <UploadsPanel uploads={uploads} />}

      <ManualTransactionModal
        open={modal === "manual"}
        onClose={() => setModal(null)}
        wells={wells}
        categories={categories}
      />
      <UploadTransactionsModal
        open={modal === "upload"}
        onClose={() => setModal(null)}
        wells={wells}
        categories={categories}
      />
    </div>
  );
}
