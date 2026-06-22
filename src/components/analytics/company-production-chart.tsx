"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { MonthlyProduction } from "@/lib/analytics/types";

type Metric = "volume" | "dollars";

const METRICS: { value: Metric; label: string }[] = [
  { value: "volume", label: "Volume" },
  { value: "dollars", label: "Revenue" },
];

interface Series {
  key: string;
  label: string;
  color: string;
}

const VOLUME_SERIES: Series[] = [
  { key: "oilBbl", label: "Oil (bbl)", color: "#059669" },
  { key: "gasMcf", label: "Gas (MCF)", color: "#800000" },
  { key: "water", label: "Salt Water (bbl)", color: "#4169e1" },
];

const DOLLAR_SERIES: Series[] = [
  { key: "revenue", label: "Net Revenue", color: "#059669" },
  { key: "cashFlow", label: "Cash Flow", color: "#4169e1" },
];

const TIME_RANGES = [
  { value: "6M", months: 6 },
  { value: "12M", months: 12 },
  { value: "All", months: Number.POSITIVE_INFINITY },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]["value"];

const tickMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const tooltipMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });
const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "YYYY-MM" → Date at the first of the month (UTC). */
function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}

export function CompanyProductionChart({
  data,
}: {
  data: MonthlyProduction[];
}) {
  const [metric, setMetric] = useState<Metric>("volume");
  const [range, setRange] = useState<TimeRange>("12M");

  const months =
    TIME_RANGES.find((r) => r.value === range)?.months ??
    Number.POSITIVE_INFINITY;
  const filtered = Number.isFinite(months) ? data.slice(-months) : data;

  const series = metric === "volume" ? VOLUME_SERIES : DOLLAR_SERIES;
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig;
  const formatAxis = (value: number) =>
    metric === "dollars" ? compactUsd.format(value) : compact.format(value);

  // Unofficial (production-report) months form a contiguous tail; shade them.
  const firstUnofficial = filtered.find((d) => !d.official)?.month;
  const lastMonth = filtered[filtered.length - 1]?.month;
  const hasUnofficial = Boolean(firstUnofficial);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Company Production</CardTitle>
        <CardDescription>
          Monthly · official figures from accounting
          {hasUnofficial ? "; shaded months are unofficial (production reports)" : ""}
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              options={METRICS}
              value={metric}
              onChange={(v) => setMetric(v as Metric)}
            />
            <Segmented
              options={TIME_RANGES.map((r) => ({ value: r.value, label: r.value }))}
              value={range}
              onChange={(v) => setRange(v as TimeRange)}
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
          <LineChart data={filtered} margin={{ left: 12, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            {hasUnofficial && firstUnofficial && lastMonth && (
              <ReferenceArea
                x1={firstUnofficial}
                x2={lastMonth}
                fill="var(--muted-foreground)"
                fillOpacity={0.08}
              />
            )}
            {metric === "dollars" && (
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            )}
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(value) =>
                tickMonthFormatter.format(monthDate(value))
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={formatAxis}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    tooltipMonthFormatter.format(monthDate(String(value)))
                  }
                />
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[min(var(--radius-md),10px)] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === opt.value &&
              "bg-background text-foreground shadow-sm hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
