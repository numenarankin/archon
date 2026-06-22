/**
 * Skip Trace PRO (Apify actor `intelscrape/skip-trace-pro`) integration:
 * normalize raw dataset items into `SkipTraceCandidate`, build actor input, and
 * call the actor for a single prospect (the on-demand path). Bulk runs are
 * triggered from scripts/run_enrichment.py; the webhook fetches the dataset via
 * `fetchDatasetItems`.
 */
import type { SkipTraceCandidate } from "./types";
import { bool, digits, num, str } from "./util";

const ACTOR_ID = "intelscrape~skip-trace-pro";
const API = "https://api.apify.com/v2";

export function hasApify(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN not configured");
  return t;
}

/** Pull a string field trying several possible key spellings. */
function pick(item: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null) return item[k];
  }
  return undefined;
}

/** Coerce an unknown into a list of email strings (array of strings or objects). */
function emailList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const e of v) {
    if (typeof e === "string") out.push(e.toLowerCase().trim());
    else if (e && typeof e === "object") {
      const addr = str((e as Record<string, unknown>).address) ??
        str((e as Record<string, unknown>).email) ??
        str((e as Record<string, unknown>).value);
      if (addr) out.push(addr.toLowerCase());
    }
  }
  return Array.from(new Set(out));
}

/** Coerce an unknown into a list of phone numbers (digits only). */
function phoneList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const p of v) {
    const d =
      typeof p === "string" || typeof p === "number"
        ? digits(p)
        : p && typeof p === "object"
          ? digits(
              (p as Record<string, unknown>).number ??
                (p as Record<string, unknown>).phone ??
                (p as Record<string, unknown>).value
            )
          : null;
    if (d) out.push(d);
  }
  return Array.from(new Set(out));
}

/** Normalize one raw Apify dataset item into a SkipTraceCandidate. */
export function normalizeCandidate(
  item: Record<string, unknown>
): SkipTraceCandidate {
  const bestEmail = str(pick(item, ["bestEmail", "email"]));
  const bestPhone = str(pick(item, ["bestPhone", "phone"]));
  const emails = emailList(item.emails);
  if (bestEmail && !emails.includes(bestEmail.toLowerCase())) {
    emails.unshift(bestEmail.toLowerCase());
  }
  const phones = phoneList(item.phones);
  const bestPhoneDigits = digits(bestPhone);
  if (bestPhoneDigits && !phones.includes(bestPhoneDigits)) {
    phones.unshift(bestPhoneDigits);
  }
  const srcRaw = pick(item, ["source", "sources"]);
  const sources = Array.isArray(srcRaw)
    ? srcRaw.filter((s): s is string => typeof s === "string")
    : str(srcRaw)
      ? [str(srcRaw) as string]
      : [];

  return {
    fullName: str(pick(item, ["fullName", "name"])),
    bestEmail: bestEmail ? bestEmail.toLowerCase() : null,
    bestEmailVerified: bool(pick(item, ["bestEmailVerified", "emailVerified"])),
    emails,
    bestPhone,
    phoneType: str(pick(item, ["phoneType", "lineType"])),
    phoneLive: bool(pick(item, ["bestPhoneLive", "phoneLive"])),
    phones,
    currentAddress: str(pick(item, ["currentAddress", "address"])),
    age: num(item.age),
    employer: str(item.employer),
    occupation: str(item.occupation),
    matchConfidence: num(item.matchConfidence),
    sourceCount: num(item.sourceCount),
    mostLikely: bool(item.mostLikely),
    lastActivityDate: str(item.lastActivityDate),
    breachExposed: bool(item.breachExposed),
    sources,
    raw: item,
  };
}

/** The default actor options shared by single and bulk runs. */
export function actorOptions(): Record<string, unknown> {
  return {
    maxResultsPerQuery: 3,
    verifyEmails: true,
    classifyPhones: true,
    verifyPhoneLiveness: true,
    sources: ["thatsthem", "pdl", "endato", "publicrecords"],
  };
}

/**
 * Enrich one prospect synchronously. Sends both the phone and the name+state so
 * the actor corroborates the two, and returns the normalized candidates for
 * `match.ts`. Used for the Phase 0 demo / calibration single lookups; the
 * production flow is the bulk run + webhook.
 */
export async function runSingle(target: {
  searchName: string;
  phone: string | null;
  state: string;
}): Promise<SkipTraceCandidate[]> {
  const input: Record<string, unknown> = {
    ...actorOptions(),
    names: [`${target.searchName}, ${target.state}`],
    searchState: target.state,
  };
  if (target.phone) input.phones = [target.phone];

  const res = await fetch(
    `${API}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    throw new Error(`Apify run failed: ${res.status} ${await res.text()}`);
  }
  const items = (await res.json()) as unknown;
  if (!Array.isArray(items)) return [];
  return items.map((i) => normalizeCandidate(i as Record<string, unknown>));
}

/** Fetch all items from a finished dataset (used by the bulk webhook). */
export async function fetchDatasetItems(
  datasetId: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${API}/datasets/${datasetId}/items?clean=true&token=${token()}`
  );
  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed: ${res.status}`);
  }
  const items = (await res.json()) as unknown;
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

/** The value the actor echoes back so we can map a result to our input. */
export function itemQuery(item: Record<string, unknown>): {
  query: string | null;
  queryType: string | null;
} {
  return {
    query: str(pick(item, ["query", "input"])),
    queryType: str(pick(item, ["queryType", "type"])),
  };
}
