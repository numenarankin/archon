import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { KpiDashboard } from "@/lib/numena/kpis-types";

const count = new Intl.NumberFormat("en-US");
const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

interface Stat {
  label: string;
  value: string;
  hint: string;
}

/** The four headline numbers across the top of the KPI dashboard. */
export function KpiStatCards({ data }: { data: KpiDashboard }) {
  const totalRaised = data.daily.reduce((sum, d) => sum + d.amountRaised, 0);

  const stats: Stat[] = [
    {
      label: "Live Issuers",
      value: count.format(data.summary.liveIssuers),
      hint: "Currently active on the platform",
    },
    {
      label: "Live Investors",
      value: count.format(data.summary.liveInvestors),
      hint: "Currently active on the platform",
    },
    {
      label: "Bounce Rate",
      value: pct.format(data.bounce.rate),
      hint: `${count.format(data.bounce.bounced)} of ${count.format(
        data.bounce.sessions
      )} landing sessions`,
    },
    {
      label: "Amount Raised",
      value: usd.format(totalRaised),
      hint: "Total across the shown period",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} size="sm" className="rounded-[0.1rem]">
          <CardHeader>
            <CardDescription>{s.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
