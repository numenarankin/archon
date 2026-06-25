"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { DailyMetric } from "@/lib/numena/kpis-types";
import { Segmented } from "./segmented";
import { ChartEmpty } from "./chart-empty";

type Metric = "investments" | "signups" | "amountRaised";

const METRICS: {
  value: Metric;
  label: string;
  color: string;
  money: boolean;
}[] = [
  { value: "investments", label: "Investments", color: "#4169e1", money: false },
  { value: "signups", label: "Signups", color: "#059669", money: false },
  { value: "amountRaised", label: "Amount Raised", color: "#800000", money: true },
];

const dayTick = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayFull = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
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

/** "YYYY-MM-DD" to a Date at midnight UTC. */
function dayDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

/** Daily investments / signups / amount raised, with a metric toggle. */
export function DailyMetricsChart({ data }: { data: DailyMetric[] }) {
  const [metric, setMetric] = useState<Metric>("investments");
  const active = METRICS.find((m) => m.value === metric) ?? METRICS[0];
  const isEmpty = data.length === 0;

  const config = {
    [metric]: { label: active.label, color: active.color },
  } satisfies ChartConfig;
  const formatAxis = (v: number) =>
    active.money ? compactUsd.format(v) : compact.format(v);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Daily Activity</CardTitle>
        <CardDescription>
          Investments, signups, and capital raised per day
        </CardDescription>
        <CardAction>
          <Segmented
            options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[300px]">
            <ChartEmpty className="h-full" />
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
            <AreaChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
              <defs>
                <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${metric})`}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${metric})`}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value) => dayTick.format(dayDate(value))}
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
                      dayFull.format(dayDate(String(value)))
                    }
                  />
                }
              />
              <Area
                dataKey={metric}
                type="monotone"
                stroke={`var(--color-${metric})`}
                strokeWidth={2}
                fill={`url(#fill-${metric})`}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
