"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/permissions-context";

interface TickerQuote {
  label: string;
  unit: string;
  price: number;
  changePct: number;
}

const POLL_MS = 60_000;

/**
 * Compact oil + natural gas price ticker for the topbar. Polls the cached
 * `/api/prices` feed (Yahoo Finance, server-side) once a minute. Hidden on
 * narrow screens to keep the header uncluttered; renders nothing until the
 * first successful fetch.
 */
export function PriceTicker() {
  // Pricing is a gated feature: hide the ticker (and skip polling /api/prices,
  // which 403s without the capability) for users who lack `view_pricing`.
  const canViewPricing = useCan("view_pricing");
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);

  useEffect(() => {
    if (!canViewPricing) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/prices");
        if (!res.ok) return;
        const data = (await res.json()) as { quotes: TickerQuote[] };
        if (active && Array.isArray(data.quotes)) setQuotes(data.quotes);
      } catch (error) {
        console.error("Price ticker fetch failed", error);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [canViewPricing]);

  if (!canViewPricing || quotes.length === 0) return null;

  return (
    <div className="hidden items-center gap-3 pr-2 lg:flex" aria-label="Commodity prices">
      {quotes.map((q) => (
        <PriceChip key={q.label} quote={q} />
      ))}
    </div>
  );
}

function PriceChip({ quote }: { quote: TickerQuote }) {
  const up = quote.changePct >= 0;
  return (
    <span
      className="flex items-baseline gap-1 whitespace-nowrap"
      title={`${quote.label} — $${quote.price.toFixed(2)}${quote.unit} (Yahoo, delayed)`}
    >
      <span className="ty-body-1 font-medium text-tertiary-text">
        {quote.label}
      </span>
      <span className="ty-body-1 font-semibold tabular-nums text-primary-text">
        ${quote.price.toFixed(2)}
      </span>
      <span
        className={cn(
          "ty-body-1 tabular-nums",
          up ? "text-success" : "text-destructive"
        )}
      >
        {up ? "▲" : "▼"}
        {Math.abs(quote.changePct).toFixed(1)}%
      </span>
    </span>
  );
}
