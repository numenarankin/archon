"use client";

import { useState } from "react";
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
import type { ProductionPoint } from "@/lib/wells/wells";

const chartConfig = {
  oilProduction: { label: "Oil (bbl/d)", color: "#059669" },
  gasProduction: { label: "Gas (MCF/d)", color: "#800000" },
  saltWater: { label: "Salt Water (bbl/d)", color: "#4169e1" },
} satisfies ChartConfig;

const TIME_RANGES = [
  { value: "1M", days: 30 },
  { value: "3M", days: 90 },
  { value: "12M", days: 365 },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]["value"];

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

export function ProductionChart({ data }: { data: ProductionPoint[] }) {
  const [range, setRange] = useState<TimeRange>("3M");
  const days = TIME_RANGES.find((r) => r.value === range)?.days ?? 90;
  // Oil is stored in barrels (converted at write time), so plot readings as-is.
  const filtered = data.slice(-days);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Production History</CardTitle>
        <CardDescription>Last {days} days · daily readings</CardDescription>
        <CardAction className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            {Object.entries(chartConfig).map(([key, item]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
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
            <YAxis tickLine={false} axisLine={false} width={48} />
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
              dataKey="oilProduction"
              type="monotone"
              stroke="var(--color-oilProduction)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="gasProduction"
              type="monotone"
              stroke="var(--color-gasProduction)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="saltWater"
              type="monotone"
              stroke="var(--color-saltWater)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
