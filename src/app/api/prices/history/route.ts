// Historical commodity prices for the pricing page chart — a daily time series
// for one commodity over a range. Upstream fetch + caching live in
// lib/pricing/feed (shared with Archon's price tools).

import { getPriceHistory } from "@/lib/pricing/feed";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import type { Commodity } from "@/lib/pricing/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Capability gate: pricing history backs the pricing feature.
  const denied = await forbidUnlessPermitted("view_pricing");
  if (denied) return denied;

  const url = new URL(req.url);
  const commodity = (url.searchParams.get("commodity") ?? "oil") as Commodity;
  const range = url.searchParams.get("range") ?? "3M";
  return Response.json({ series: await getPriceHistory(commodity, range) });
}
