"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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
import type { CommodityMeta } from "@/lib/pricing/types";

export const TIME_RANGES = [
  { value: "1M", days: 30 },
  { value: "3M", days: 90 },
  { value: "12M", days: 365 },
] as const;

export type PriceRange = (typeof TIME_RANGES)[number]["value"];

/** One merged row: the benchmark close and the org's posted price for a date. */
export interface PriceChartPoint {
  date: string;
  commodity?: number;
  posted?: number;
  /** Forward-projected posted price (drawn faded). */
  projected?: number;
}

const BENCHMARK_COLOR = "#64748b";

const tickDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface PriceChartProps {
  data: PriceChartPoint[];
  meta: CommodityMeta;
  range: PriceRange;
  onRangeChange: (range: PriceRange) => void;
  loading?: boolean;
}

export function PriceChart({
  data,
  meta,
  range,
  onRangeChange,
  loading,
}: PriceChartProps) {
  // Low-priced commodities (gas, ~$2–4) need cents on the axis or adjacent ticks
  // collapse to the same whole-dollar label; oil (~$70) reads better as whole $.
  const yDecimals = meta.commodity === "gas" ? 2 : 0;

  const chartConfig = useMemo(
    () =>
      ({
        commodity: {
          label: `${meta.benchmark} ($${meta.unit})`,
          color: BENCHMARK_COLOR,
        },
        posted: {
          label: `Posted ($${meta.unit})`,
          color: meta.postedColor,
        },
        projected: {
          label: "Projected",
          color: meta.postedColor,
        },
      }) satisfies ChartConfig,
    [meta]
  );

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>{meta.benchmark} vs posted price</CardTitle>
        <CardDescription>
          {meta.benchmark} benchmark against the price you received.
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            {Object.entries(chartConfig).map(([key, item]) =>
              key === "projected" ? (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-0 w-3"
                    style={{
                      borderTop: `2px dashed ${item.color}`,
                    }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
              ) : (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-0.5 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
              )
            )}
          </div>
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
                onClick={() => onRangeChange(r.value)}
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
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={(value) =>
                tickDateFormatter.format(new Date(value))
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(value) => `$${Number(value).toFixed(yDecimals)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    tooltipDateFormatter.format(new Date(value))
                  }
                />
              }
            />
            <Line
              dataKey="commodity"
              type="monotone"
              stroke="var(--color-commodity)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              dataKey="posted"
              type="monotone"
              stroke="var(--color-posted)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              dataKey="projected"
              type="monotone"
              stroke="var(--color-projected)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
        {loading && (
          <p className="mt-2 text-xs text-muted-foreground">Loading prices…</p>
        )}
      </CardContent>
    </Card>
  );
}
