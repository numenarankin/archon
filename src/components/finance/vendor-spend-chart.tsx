"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

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

interface VendorSpendChartProps {
  data: { counterparty: string; spend: number }[];
}

const CHART_CONFIG = {
  spend: { label: "Spend", color: "#4169e1" },
} satisfies ChartConfig;

const axisCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function VendorSpendChart({ data }: VendorSpendChartProps) {
  return (
    <DashboardCard className="gap-0">
      <CardHeader>
        <CardTitle>Vendor outflows</CardTitle>
        <CardDescription>
          Outflow by counterparty, last 90 days (settled only).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ChartContainer
          config={CHART_CONFIG}
          className="aspect-auto h-72 w-full"
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => axisCurrencyFormatter.format(Number(v))}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="counterparty"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="spend"
              fill="var(--color-spend)"
              fillOpacity={0.7}
              radius={[0, 2, 2, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </DashboardCard>
  );
}
