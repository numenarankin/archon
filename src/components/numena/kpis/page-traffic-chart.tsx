"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { PageTraffic } from "@/lib/numena/kpis-types";
import { ChartEmpty } from "./chart-empty";

const config = {
  users: { label: "Users", color: "#4169e1" },
} satisfies ChartConfig;

/** Horizontal bars of distinct users per page / tab, busiest first. */
export function PageTrafficChart({ data }: { data: PageTraffic[] }) {
  const isEmpty = data.length === 0;
  const rows = [...data].sort((a, b) => b.users - a.users);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Users by Page</CardTitle>
        <CardDescription>
          Distinct users seen on each page or tab
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[300px]">
            <ChartEmpty className="h-full" />
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="page"
                type="category"
                tickLine={false}
                axisLine={false}
                width={120}
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
              <Bar dataKey="users" fill="var(--color-users)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
