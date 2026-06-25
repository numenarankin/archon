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
import { FinancialChart } from "@/components/budgeting/financial-chart";
import { CategoryTable } from "@/components/budgeting/category-table";
import { LedgerPanel } from "@/components/budgeting/ledger-panel";
import { UploadsPanel } from "@/components/budgeting/uploads-panel";
import { ManualTransactionModal } from "@/components/budgeting/manual-transaction-modal";
import { UploadTransactionsModal } from "@/components/budgeting/upload-transactions-modal";
import { aggregateMonthly, summarizeByCategory } from "@/lib/budgeting/derive";
import type { Category } from "@/lib/budgeting/categories";
import type { Transaction } from "@/lib/budgeting/types";
import type { BudgetUpload } from "@/lib/budgeting/uploads";

type Tab = "overview" | "ledger" | "uploads";

interface BudgetingWorkspaceProps {
  transactions: Transaction[];
  /** The budget category list, for the Add Transaction forms. */
  categories: Category[];
  /** Upload batches, for the Uploads tab. */
  uploads: BudgetUpload[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "ledger", label: "Ledger" },
  { key: "uploads", label: "Uploads" },
];

/**
 * The /budgeting page: an Overview tab (monthly cash-flow chart + category
 * breakdown), a Ledger tab (every transaction, editable inline), and an Uploads
 * tab. An Add Transaction action sits on the right of the header.
 */
export function BudgetingWorkspace({
  transactions,
  categories,
  uploads,
}: BudgetingWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<"manual" | "upload" | null>(null);

  const series = useMemo(
    () => aggregateMonthly(transactions),
    [transactions]
  );
  const categorySummaries = useMemo(
    () => summarizeByCategory(transactions),
    [transactions]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
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
          <CategoryTable categories={categorySummaries} />
        </>
      )}
      {tab === "ledger" && (
        <LedgerPanel transactions={transactions} categories={categories} />
      )}
      {tab === "uploads" && <UploadsPanel uploads={uploads} />}

      <ManualTransactionModal
        open={modal === "manual"}
        onClose={() => setModal(null)}
        categories={categories}
      />
      <UploadTransactionsModal
        open={modal === "upload"}
        onClose={() => setModal(null)}
        categories={categories}
      />
    </div>
  );
}
