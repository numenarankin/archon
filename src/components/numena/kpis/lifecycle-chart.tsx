"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  Card,
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
import type { StageCount } from "@/lib/numena/kpis-types";
import { ChartEmpty } from "./chart-empty";

interface LifecycleChartProps {
  title: string;
  description: string;
  data: StageCount[];
  /** Per-stage display label + color, keyed by the stage value. */
  stageMeta: Record<string, { label: string; color: string }>;
}

/**
 * A horizontal bar chart of how many records sit in each lifecycle stage.
 * Reused for both the investment and offering lifecycles.
 */
export function LifecycleChart({
  title,
  description,
  data,
  stageMeta,
}: LifecycleChartProps) {
  const isEmpty = data.every((d) => d.count === 0);

  const config = Object.fromEntries(
    data.map((d) => [
      d.stage,
      {
        label: stageMeta[d.stage]?.label ?? d.stage,
        color: stageMeta[d.stage]?.color ?? "#4169e1",
      },
    ])
  ) satisfies ChartConfig;

  const rows = data.map((d) => ({
    ...d,
    label: stageMeta[d.stage]?.label ?? d.stage,
    fill: stageMeta[d.stage]?.color ?? "#4169e1",
  }));

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[260px]">
            <ChartEmpty className="h-full" />
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="count" radius={4}>
                {rows.map((r) => (
                  <Cell key={r.stage} fill={r.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
