"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  PriceChart,
  type PriceChartPoint,
  type PriceRange,
} from "@/components/pricing/price-chart";
import { PostedPriceTable } from "@/components/pricing/posted-price-table";
import {
  COMMODITIES,
  type Commodity,
  type PricePoint,
} from "@/lib/pricing/types";

const ORDER: Commodity[] = ["oil", "gas"];

interface PricingWorkspaceProps {
  /** Posted prices per commodity, derived from the accounting ledger. */
  posted: Record<Commodity, PricePoint[]>;
  /** Forward-projected posted prices (last actual month → now), shown faded. */
  projected: Record<Commodity, PricePoint[]>;
}

/** Merge benchmark, posted, and projected series into rows keyed by date. */
function mergeSeries(
  commodity: PricePoint[],
  posted: PricePoint[],
  projected: PricePoint[]
): PriceChartPoint[] {
  const byDate = new Map<string, PriceChartPoint>();
  const upsert = (date: string) => {
    const existing = byDate.get(date) ?? { date };
    byDate.set(date, existing);
    return existing;
  };
  for (const p of commodity) upsert(p.date).commodity = p.price;
  for (const p of posted) upsert(p.date).posted = p.price;
  for (const p of projected) upsert(p.date).projected = p.price;
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function PricingWorkspace({ posted, projected }: PricingWorkspaceProps) {
  const [commodity, setCommodity] = useState<Commodity>("oil");
  const [range, setRange] = useState<PriceRange>("3M");
  const [series, setSeries] = useState<PricePoint[]>([]);
  // Loading is derived: true until the series for the current params has loaded.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const meta = COMMODITIES[commodity];
  const reqKey = `${commodity}:${range}`;
  const loading = loadedKey !== reqKey;

  // Fetch benchmark history whenever the commodity or range changes. State is
  // only set inside the async callbacks (never synchronously in the effect).
  useEffect(() => {
    let active = true;
    fetch(`/api/prices/history?commodity=${commodity}&range=${range}`)
      .then((res) => (res.ok ? res.json() : { series: [] }))
      .then((data: { series: PricePoint[] }) => {
        if (!active) return;
        setSeries(Array.isArray(data.series) ? data.series : []);
        setLoadedKey(reqKey);
      })
      .catch((error) => {
        console.error("Price history fetch failed", error);
        if (!active) return;
        setSeries([]);
        setLoadedKey(reqKey);
      });
    return () => {
      active = false;
    };
  }, [commodity, range, reqKey]);

  const merged = useMemo(
    () => mergeSeries(series, posted[commodity], projected[commodity]),
    [series, posted, projected, commodity]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header toggle: Oil / Gas, styled like the People page header. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {ORDER.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={commodity === c}
            onClick={() => setCommodity(c)}
            className={cn(
              "font-heading text-2xl font-semibold tracking-tight transition-colors",
              commodity === c
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            {COMMODITIES[c].label}
          </button>
        ))}
      </div>

      <PriceChart
        data={merged}
        meta={meta}
        range={range}
        onRangeChange={setRange}
        loading={loading}
      />

      <PostedPriceTable rows={posted[commodity]} meta={meta} />
    </div>
  );
}
