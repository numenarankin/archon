import "server-only";
import type { Commodity, PricePoint } from "@/lib/pricing/types";

/**
 * Shared commodity price feed (Yahoo Finance chart endpoint). Powers both the
 * topbar ticker / pricing chart API routes and Archon's price tools, so the
 * upstream fetch + in-memory caching live in one place. Yahoo's feed is
 * unofficial + exchange-delayed (~10 min) — fine for a ticker, not for billing.
 */

/** A latest quote for the ticker: price + change vs previous close. */
export interface CommodityQuote {
  /** Short display label, e.g. "WTI". */
  label: string;
  /** Unit suffix, e.g. "/bbl". */
  unit: string;
  /** Latest price in USD. */
  price: number;
  /** Percent change vs the previous close. */
  changePct: number;
}

const UA = "Mozilla/5.0 (compatible; SkyTicker/1.0)";

const SYMBOLS: { symbol: string; label: string; unit: string }[] = [
  { symbol: "CL=F", label: "WTI", unit: "/bbl" },
  { symbol: "NG=F", label: "Nat Gas", unit: "/MMBtu" },
];

/** App commodity → Yahoo futures symbol. */
const SYMBOL: Record<Commodity, string> = {
  oil: "CL=F", // WTI crude
  gas: "NG=F", // Henry Hub natural gas
};

/** App range token → Yahoo range token. */
const RANGE: Record<string, string> = {
  "1M": "1mo",
  "3M": "3mo",
  "12M": "1y",
};

const QUOTE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 5 * 60_000;

let quoteCache: { at: number; quotes: CommodityQuote[] } | null = null;
const historyCache = new Map<string, { at: number; series: PricePoint[] }>();

interface YahooMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}

interface YahooChart {
  chart?: {
    result?: {
      meta?: YahooMeta;
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
}

async function fetchYahoo(url: string): Promise<YahooChart | null> {
  // Yahoo rejects requests without a browser-like User-Agent.
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as YahooChart;
}

async function fetchQuote(
  symbol: string
): Promise<{ price: number; prevClose: number } | null> {
  const data = await fetchYahoo(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  const price = meta.regularMarketPrice;
  const prevClose =
    typeof meta.chartPreviousClose === "number"
      ? meta.chartPreviousClose
      : typeof meta.previousClose === "number"
        ? meta.previousClose
        : price;
  return { price, prevClose };
}

/** Latest WTI + Henry Hub quotes (cached ~1 min). Last good data on a blip. */
export async function getCommodityQuotes(): Promise<CommodityQuote[]> {
  if (quoteCache && Date.now() - quoteCache.at < QUOTE_TTL_MS) {
    return quoteCache.quotes;
  }

  const settled = await Promise.all(
    SYMBOLS.map(async (s) => {
      try {
        const q = await fetchQuote(s.symbol);
        if (!q) return null;
        const changePct = q.prevClose
          ? ((q.price - q.prevClose) / q.prevClose) * 100
          : 0;
        return { label: s.label, unit: s.unit, price: q.price, changePct };
      } catch (error) {
        console.error(`price fetch failed for ${s.symbol}`, error);
        return null;
      }
    })
  );

  const quotes = settled.filter((q): q is CommodityQuote => q !== null);
  // Only refresh the cache on real data, so a transient blip serves last good.
  if (quotes.length > 0) quoteCache = { at: Date.now(), quotes };
  return quotes.length > 0 ? quotes : (quoteCache?.quotes ?? []);
}

async function fetchSeries(
  symbol: string,
  yahooRange: string
): Promise<PricePoint[]> {
  const data = await fetchYahoo(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=${yahooRange}&interval=1d`
  );
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  const series: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (typeof close !== "number") continue; // skip gaps/holidays
    series.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      price: close,
    });
  }
  return series;
}

/** Daily price history for one commodity over a range (cached ~5 min). */
export async function getPriceHistory(
  commodity: Commodity,
  range: string
): Promise<PricePoint[]> {
  const symbol = SYMBOL[commodity] ?? SYMBOL.oil;
  const yahooRange = RANGE[range] ?? "3mo";
  const key = `${symbol}:${yahooRange}`;

  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.series;

  try {
    const series = await fetchSeries(symbol, yahooRange);
    if (series.length > 0) historyCache.set(key, { at: Date.now(), series });
    return series.length > 0 ? series : (hit?.series ?? []);
  } catch (error) {
    console.error(`price history fetch failed for ${key}`, error);
    return hit?.series ?? [];
  }
}
