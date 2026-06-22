/**
 * Bulk-run webhook receiver. Apify calls this when a Skip Trace PRO bulk run
 * (kicked off by scripts/run_enrichment.py) finishes. We fetch the run's
 * dataset, map each returned person back to the operator we queried for, then
 * disambiguate / score / store exactly like the on-demand path.
 *
 * POST /api/enrich/callback?minWells=20&secret=...
 *   body: the Apify webhook payload ({ resource: { defaultDatasetId } }).
 *
 * Results are mapped to targets by the echoed query: phone first (we query
 * phone-first), then name, then the result's own best phone as a fallback.
 */
import type { EnrichTarget } from "@/lib/enrichment/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  fetchDatasetItems,
  hasApify,
  itemQuery,
  normalizeCandidate,
} from "@/lib/enrichment/skiptrace";
import { allTargets, persistTarget } from "@/lib/enrichment/persist";
import { digits, normName, phoneKey } from "@/lib/enrichment/util";

export const runtime = "nodejs";
export const maxDuration = 300; // a large dataset can take a while to process

interface ApifyWebhook {
  resource?: { defaultDatasetId?: string; id?: string };
}

/**
 * Index targets by phone and by name. Values are arrays because one person /
 * phone can be the decision-maker for several operators — a single scraped
 * result must fan out to all of them.
 */
function buildIndex(targets: EnrichTarget[]) {
  const byPhone = new Map<string, EnrichTarget[]>();
  const byName = new Map<string, EnrichTarget[]>();
  const push = (m: Map<string, EnrichTarget[]>, key: string, t: EnrichTarget) => {
    const arr = m.get(key);
    if (arr) arr.push(t);
    else m.set(key, [t]);
  };
  for (const t of targets) {
    const pk = phoneKey(t.phone);
    if (pk) push(byPhone, pk, t);
    push(byName, normName(t.searchName), t);
    push(byName, normName(`${t.searchName} ${t.state}`), t);
  }
  return { byPhone, byName };
}

export async function POST(req: Request) {
  if (!hasApify()) {
    return new Response("Enrichment not configured (APIFY_TOKEN)", { status: 503 });
  }

  const url = new URL(req.url);
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (secret && url.searchParams.get("secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  const minWells = Number(url.searchParams.get("minWells") ?? 20);

  let payload: ApifyWebhook;
  try {
    payload = (await req.json()) as ApifyWebhook;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const datasetId = payload.resource?.defaultDatasetId;
  if (!datasetId) {
    return new Response("No datasetId in payload", { status: 400 });
  }

  const admin = getSupabaseAdmin();

  try {
    const [items, targets] = await Promise.all([
      fetchDatasetItems(datasetId),
      allTargets(admin, minWells),
    ]);
    const { byPhone, byName } = buildIndex(targets);

    // Group the returned people under every operator we searched them for (a
    // shared person/phone fans out to all its operators).
    const grouped = new Map<number, { target: EnrichTarget; items: Record<string, unknown>[] }>();
    let mappedItems = 0;
    for (const item of items) {
      const { query } = itemQuery(item);
      let matched: EnrichTarget[] | undefined;
      const qDigits = phoneKey(query);
      if (qDigits) matched = byPhone.get(qDigits);
      if (!matched && query) matched = byName.get(normName(query));
      if (!matched) {
        const bp = phoneKey(digits(item.bestPhone));
        if (bp) matched = byPhone.get(bp);
      }
      if (!matched || matched.length === 0) continue; // unmappable — skip
      mappedItems += 1;
      for (const target of matched) {
        const bucket = grouped.get(target.operatorNo) ?? { target, items: [] };
        bucket.items.push(item);
        grouped.set(target.operatorNo, bucket);
      }
    }

    let stored = 0;
    for (const { target, items: raws } of grouped.values()) {
      const candidates = raws.map(normalizeCandidate);
      await persistTarget(admin, target, candidates);
      stored += 1;
    }

    return Response.json({
      received: true,
      datasetItems: items.length,
      operatorsStored: stored,
      unmapped: items.length - mappedItems,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "callback failed";
    console.error("enrich callback failed", datasetId, msg);
    // 200 so Apify does not hammer retries on a transient error mid-batch.
    return Response.json({ received: true, error: msg });
  }
}
