import { getFinanceData } from "@/lib/mercury/finance-data";
import { BurnKpi, CashKpi, RunwayKpi } from "@/components/finance/kpi-cards";
import { CashChart } from "@/components/finance/cash-chart";
import { VendorSpendChart } from "@/components/finance/vendor-spend-chart";
import {
  MoneyInTable,
  MoneyOutTable,
} from "@/components/finance/transaction-tables";
import { requirePermission } from "@/lib/auth/permissions";

export default async function FinancePage() {
  await requirePermission("view_finance");
  const {
    accounts,
    totalAvailable,
    totalCurrent,
    cashSeries,
    burnPerMonth,
    topCounterparties,
    moneyIn,
    moneyOut,
    isLive,
  } = await getFinanceData();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Finance
        </h1>
        <p className="text-sm text-muted-foreground">
          Live cash, burn, and transactions from your Mercury accounts
        </p>
      </div>

      {!isLive && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing sample data. Set{" "}
          <code className="font-mono">MERCURY_API_KEY</code> in{" "}
          <code className="font-mono">.env.local</code> to connect your live
          Mercury account.
        </p>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CashKpi
          accounts={accounts}
          totalAvailable={totalAvailable}
          totalCurrent={totalCurrent}
        />
        <BurnKpi burnPerMonth={burnPerMonth} />
        <RunwayKpi cash={totalAvailable} burnPerMonth={burnPerMonth} />
      </div>

      {/* Charts: cash trend (wide) + vendor outflows */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <CashChart series={cashSeries} />
        </div>
        <div className="min-w-0">
          <VendorSpendChart data={topCounterparties} />
        </div>
      </div>

      {/* Transactions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoneyInTable transactions={moneyIn} />
        <MoneyOutTable transactions={moneyOut} />
      </div>
    </div>
  );
}
