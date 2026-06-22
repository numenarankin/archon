// Commodity price ticker feed (topbar). Latest WTI crude + Henry Hub quotes;
// the upstream fetch + caching live in lib/pricing/feed (shared with Archon's
// price tools).

import { getCommodityQuotes } from "@/lib/pricing/feed";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";

// Always run dynamically (never statically cached at build time).
export const dynamic = "force-dynamic";

export async function GET() {
  // Capability gate: the price feed backs the pricing feature (`view_pricing`).
  const denied = await forbidUnlessPermitted("view_pricing");
  if (denied) return denied;

  return Response.json({ quotes: await getCommodityQuotes() });
}
