"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
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
import { DashboardCard } from "@/components/finance/dashboard-card";
import type { CashSnapshot } from "@/lib/mercury/types";

interface CashChartProps {
  series: CashSnapshot[];
}

const CHART_CONFIG = {
  cash: { label: "Cash", color: "#4169e1" },
} satisfies ChartConfig;

const axisCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtTick(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CashChart({ series }: CashChartProps) {
  const gradientId = useId().replace(/:/g, "");

  // Show every 5th day so the X axis stays readable across ~180 days.
  const sampled = useMemo(
    () => series.filter((_, i) => i % 5 === 0 || i === series.length - 1),
    [series]
  );

  return (
    <DashboardCard className="gap-0">
      <CardHeader>
        <CardTitle>Cash over time</CardTitle>
        <CardDescription>
          Derived: walks settled transactions backward from current available
          balance. Mercury has no balance-history endpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ChartContainer
          config={CHART_CONFIG}
          className="aspect-auto h-72 w-full"
        >
          <AreaChart
            data={sampled}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cash)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-cash)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtTick}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v) => axisCurrencyFormatter.format(Number(v))}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
              }
            />
            <Area
              type="linear"
              dataKey="cash"
              stroke="var(--color-cash)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </DashboardCard>
  );
}
