"use client";

import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FINANCIAL_METRICS,
  FINANCIAL_METRIC_ORDER,
  type FinancialMetric,
  type FinancialPoint,
} from "@/lib/budgeting/types";

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

const axisCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Color used for the portion of the line that dips below zero. */
const NEGATIVE_COLOR = "#dc2626";

/**
 * Fraction (0–1, from the top) of the value range where zero sits. Used as the
 * stop in a vertical gradient so the line is `color` above zero and red below.
 */
function zeroOffset(values: number[]): number {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  if (max <= 0) return 0; // entirely negative → all red
  if (min >= 0) return 1; // entirely positive → no red
  return max / (max - min);
}

interface FinancialChartProps {
  /** Monthly points, oldest first. */
  data: FinancialPoint[];
}

/**
 * Cash-flow line chart. A dropdown in the top-right selects which series
 * (income, expenses, or net cash flow) is plotted and titles the chart; range
 * buttons limit the window.
 */
export function FinancialChart({ data }: FinancialChartProps) {
  const [metric, setMetric] = useState<FinancialMetric>("net");
  const [range, setRange] = useState<TimeRange>("12M");

  const months =
    TIME_RANGES.find((r) => r.value === range)?.months ??
    Number.POSITIVE_INFINITY;
  const filtered = Number.isFinite(months) ? data.slice(-months) : data;
  const meta = FINANCIAL_METRICS[metric];

  const gradientId = useId();
  const offset = useMemo(
    () => zeroOffset(filtered.map((d) => d[metric])),
    [filtered, metric]
  );

  const chartConfig = useMemo<ChartConfig>(
    () => ({ [metric]: { label: meta.label, color: meta.color } }),
    [metric, meta]
  );

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>{meta.label}</CardTitle>
        <CardAction className="flex flex-col items-end gap-2">
          <Select
            value={metric}
            onValueChange={(v) => setMetric(v as FinancialMetric)}
          >
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue>
                {(value) =>
                  FINANCIAL_METRICS[value as FinancialMetric]?.label ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FINANCIAL_METRIC_ORDER.map((m) => (
                <SelectItem key={m} value={m}>
                  {FINANCIAL_METRICS[m].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            role="group"
            aria-label="Select time range"
            className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5"
          >
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={range === r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-[min(var(--radius-md),10px)] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  range === r.value &&
                    "bg-background text-foreground shadow-sm hover:text-foreground"
                )}
              >
                {r.value}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[320px] w-full"
        >
          <LineChart data={filtered} margin={{ left: 12, right: 12, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={meta.color} />
                <stop offset={offset} stopColor={meta.color} />
                <stop offset={offset} stopColor={NEGATIVE_COLOR} />
                <stop offset={1} stopColor={NEGATIVE_COLOR} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                tickMonthFormatter.format(new Date(value))
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value) =>
                axisCurrencyFormatter.format(Number(value))
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    tooltipMonthFormatter.format(new Date(value))
                  }
                />
              }
            />
            <Line
              dataKey={metric}
              type="monotone"
              stroke={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
