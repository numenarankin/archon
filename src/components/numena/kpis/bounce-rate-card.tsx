"use client";

import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { BounceRate } from "@/lib/numena/kpis-types";
import { ChartEmpty } from "./chart-empty";

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const count = new Intl.NumberFormat("en-US");

const config = {
  value: { label: "Bounce rate", color: "#800000" },
} satisfies ChartConfig;

/** A radial gauge of the landing-page bounce rate. */
export function BounceRateCard({ data }: { data: BounceRate }) {
  const isEmpty = data.sessions === 0;
  const value = Math.min(Math.max(data.rate, 0), 1);
  const chartData = [{ name: "bounce", value: value * 100, fill: "var(--color-value)" }];
  const endAngle = 90 - 360 * value;

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Bounce Rate</CardTitle>
        <CardDescription>
          Landing sessions that never navigated onward
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[260px]">
            <ChartEmpty className="h-full" />
          </div>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square h-[260px]">
            <RadialBarChart
              data={chartData}
              startAngle={90}
              endAngle={endAngle}
              innerRadius={90}
              outerRadius={130}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[96, 84]}
              />
              <RadialBar dataKey="value" background cornerRadius={8} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      const cx = viewBox.cx ?? 0;
                      const cy = viewBox.cy ?? 0;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={cx}
                            y={cy}
                            className="fill-foreground text-3xl font-semibold tabular-nums"
                          >
                            {pct.format(value)}
                          </tspan>
                          <tspan
                            x={cx}
                            y={cy + 24}
                            className="fill-muted-foreground text-xs"
                          >
                            {count.format(data.bounced)} of{" "}
                            {count.format(data.sessions)}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </PolarRadiusAxis>
            </RadialBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
