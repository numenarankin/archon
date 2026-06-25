import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Delta } from "@/components/finance/delta";
import type { MercuryAccount } from "@/lib/mercury/types";

function fmtUSD(n: number, opts?: { compact?: boolean }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 0,
  }).format(n);
}

interface StatCardProps {
  label: string;
  value: string;
  children?: React.ReactNode; // breakdown / hint
}

/** Headline stat card — mirrors the KPI dashboard's stat-card pattern. */
function StatCard({ label, value, children }: StatCardProps) {
  return (
    <Card size="sm" className="h-full rounded-[0.1rem]">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}

interface CashKpiProps {
  accounts: MercuryAccount[];
  totalAvailable: number;
  totalCurrent: number;
}

export function CashKpi({
  accounts,
  totalAvailable,
  totalCurrent,
}: CashKpiProps) {
  const inFlight = totalCurrent - totalAvailable;

  return (
    <StatCard label="Cash on hand" value={fmtUSD(totalAvailable)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {accounts.map((a) => (
          <span key={a.id} className="flex items-baseline gap-1">
            <span>{a.nickname ?? a.name}</span>
            <span className="tabular-nums text-foreground">
              {fmtUSD(a.availableBalance, { compact: true })}
            </span>
          </span>
        ))}
      </div>
      {Math.abs(inFlight) > 0.5 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {fmtUSD(inFlight)} in flight
        </p>
      )}
    </StatCard>
  );
}

export function BurnKpi({ burnPerMonth }: { burnPerMonth: number }) {
  return (
    <StatCard label="Burn / month" value={fmtUSD(burnPerMonth)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Delta value={5.7} />
        <span>3-month average of settled outflow</span>
      </div>
    </StatCard>
  );
}

interface RunwayKpiProps {
  cash: number;
  burnPerMonth: number;
}

export function RunwayKpi({ cash, burnPerMonth }: RunwayKpiProps) {
  const months = burnPerMonth > 0 ? cash / burnPerMonth : Infinity;
  return (
    <StatCard
      label="Runway"
      value={isFinite(months) ? `${months.toFixed(1)} mo` : "∞"}
    >
      <p className="text-xs text-muted-foreground">
        {isFinite(months)
          ? `at ${fmtUSD(burnPerMonth, { compact: true })}/mo burn`
          : "no settled outflow detected"}
      </p>
    </StatCard>
  );
}
