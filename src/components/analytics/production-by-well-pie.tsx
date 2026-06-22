"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDownIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WellProductionTotal } from "@/lib/analytics/types";

type Metric = "oil" | "gas" | "revenue" | "cashFlow";

const METRICS: { value: Metric; label: string }[] = [
  { value: "oil", label: "Oil (bbl)" },
  { value: "gas", label: "Gas (MCF)" },
  { value: "revenue", label: "Revenue ($)" },
  { value: "cashFlow", label: "Cash Flow ($)" },
];

const USD_METRICS: Metric[] = ["revenue", "cashFlow"];

// A distinct color per well slice, cycled if there are more wells than colors.
const COLORS = [
  "#059669",
  "#800000",
  "#4169e1",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#dc2626",
  "#475569",
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function valueOf(well: WellProductionTotal, metric: Metric): number {
  if (metric === "oil") return well.oilBbl;
  if (metric === "gas") return well.gasMcf;
  if (metric === "cashFlow") return well.cashFlow;
  return well.revenue;
}

function formatValue(value: number, metric: Metric): string {
  return USD_METRICS.includes(metric)
    ? usdFormatter.format(value)
    : numberFormatter.format(value);
}

export function ProductionByWellPie({
  wells,
}: {
  wells: WellProductionTotal[];
}) {
  const [metric, setMetric] = useState<Metric>("oil");
  const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? "";

  const slices = wells
    .map((well, index) => ({
      name: well.name,
      value: valueOf(well, metric),
      color: COLORS[index % COLORS.length],
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Production by Well</CardTitle>
        <CardDescription>Share of {metricLabel.toLowerCase()}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                />
              }
            >
              {metricLabel}
              <ChevronDownIcon className="size-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuRadioGroup
                value={metric}
                onValueChange={(value) => setMetric(value as Metric)}
              >
                {METRICS.map((m) => (
                  <DropdownMenuRadioItem key={m.value} value={m.value}>
                    {m.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No production to display.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    cursor={false}
                    formatter={(value) => formatValue(Number(value), metric)}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                    }}
                  />
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={1}
                    strokeWidth={1}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-1.5">
              {slices.map((slice) => (
                <li
                  key={slice.name}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatValue(slice.value, metric)}
                    {total > 0 && (
                      <span className="ml-1.5 text-xs">
                        ({Math.round((slice.value / total) * 100)}%)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
