import "server-only";

import type { BaseRow, ExportData, IssuerGroup } from "@/lib/numena/prospect-csv";
import { classifyIssuer, isEntity } from "@/lib/numena/enrichment/bucketing";
import {
  runDeepDive,
  type DeepDiveResult,
} from "@/lib/numena/enrichment/deep-dive-agent";

/**
 * Primary-Agent orchestration of the enrichment run — in memory, no persistence.
 *
 * Roles stay separate (per the SOP): the PA is this deterministic orchestrator
 * (bucketing, Bucket-B self-copy, cross-reference, writing results); each
 * Deep-Dive Agent is an independent {@link runDeepDive} worker, run in a bounded
 * concurrency pool. Only **Confirmed** results are written; Probable/Unverified
 * are left blank. Rows are mutated in place — never added or removed — so the
 * enriched sheet has exactly the same rows as the plain one.
 */

/** Progress for the streaming UI. */
export interface EnrichProgress {
  phase: "research";
  done: number;
  total: number;
}

/** Summary counts for the caller. */
export interface EnrichStats {
  issuers: number;
  selfCopied: number;
  researched: number;
  confirmed: number;
  probable: number;
  unverified: number;
  crossRefUpgrades: number;
}

export interface EnrichOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (p: EnrichProgress) => void;
}

/** Placeholder Company Name for an offering whose operator couldn't be resolved. */
const TBD = "TBD";

/** "Source: <Firm>, <URL>" provenance string (SOP format), or "". */
function sourceString(firm: string, url: string): string {
  if (!firm && !url) return "";
  return `Source: ${firm || "web"}, ${url}`.trim();
}

/**
 * Final guard before a researched name reaches the sheet: a real firm name
 * starts with a letter/digit, has a few real letters, and isn't a sentence or
 * leaked-reasoning fragment. Catches anything the DDA sanitizer missed (incl.
 * cached results) so garbage can never be written.
 */
function isPlausibleName(v: string): boolean {
  if (!v || v.length > 70) return false;
  if (!/^[A-Za-z0-9]/.test(v)) return false;
  if (v.replace(/[^A-Za-z]/g, "").length < 3) return false;
  if (v.split(/\s+/).length > 9) return false;
  if (/[<>{}]|https?:\/\/|source:|confirm/i.test(v)) return false;
  return true;
}

/** Digits-only phone for exact cross-reference matching. */
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Apply a confirmed RealCo (and URLs/source) to every row of an issuer. */
function applyToIssuer(
  rows: BaseRow[],
  group: IssuerGroup,
  fields: { companyName: string; website: string; linkedIn: string; sources: string }
): void {
  for (const idx of group.rowIndexes) {
    const row = rows[idx];
    row.companyName = fields.companyName;
    if (fields.website) row.companyWebsite = fields.website;
    if (fields.linkedIn) row.companyLinkedIn = fields.linkedIn;
    row.sources = fields.sources;
  }
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

/** A confirmed research outcome, kept for the cross-reference pass. */
interface Confirmed {
  group: IssuerGroup;
  result: DeepDiveResult;
}

/**
 * Enrich `data.rows` in place. Returns summary stats. Mutates rows only —
 * the array length is invariant.
 */
export async function enrichRows(
  data: ExportData,
  opts: EnrichOptions = {}
): Promise<EnrichStats> {
  const { rows, issuers } = data;
  const concurrency = opts.concurrency ?? 8;

  const stats: EnrichStats = {
    issuers: issuers.length,
    selfCopied: 0,
    researched: 0,
    confirmed: 0,
    probable: 0,
    unverified: 0,
    crossRefUpgrades: 0,
  };

  // PA step 3: deterministic Bucket-B self-copy; collect RESEARCH issuers.
  const toResearch: IssuerGroup[] = [];
  for (const group of issuers) {
    const { bucket } = classifyIssuer(group);
    if (bucket === "B") {
      applyToIssuer(rows, group, {
        companyName: group.listedIssuer,
        website: "",
        linkedIn: "",
        sources: "",
      });
      stats.selfCopied += 1;
    } else {
      toResearch.push(group);
    }
  }
  stats.researched = toResearch.length;

  // PA ⇄ DDA: one Deep-Dive Agent per research issuer, bounded concurrency.
  const confirmedList: Confirmed[] = [];
  let done = 0;
  opts.onProgress?.({ phase: "research", done, total: toResearch.length });

  await pool(toResearch, concurrency, async (group) => {
    const { reason } = classifyIssuer(group);
    const result = await runDeepDive(
      {
        listedIssuer: group.listedIssuer,
        location: group.location,
        phone: group.phone,
        persons: group.persons,
        hint: reason,
      },
      opts.signal
    );

    const resolved =
      (result.confidence === "Confirmed" || result.confidence === "Probable") &&
      isPlausibleName(result.realCompany);

    if (resolved) {
      // Person-consensus firm connected to the issuer. Confirmed = hard link;
      // Probable = solid consensus, softer link (kept per inclusion bias).
      applyToIssuer(rows, group, {
        companyName: result.realCompany,
        website: result.website,
        linkedIn: result.linkedIn,
        sources: sourceString(
          result.sourceFirm || result.realCompany,
          result.sourceUrl || result.website
        ),
      });
      confirmedList.push({ group, result });
      if (result.confidence === "Confirmed") stats.confirmed += 1;
      else stats.probable += 1;
    } else {
      // No firm could be connected to the issuer → mark TBD, but KEEP the
      // offering's rows. The cross-reference pass may still upgrade it if a
      // shared-signal sibling resolves.
      applyToIssuer(rows, group, {
        companyName: TBD,
        website: "",
        linkedIn: "",
        sources: "",
      });
      stats.unverified += 1;
    }

    done += 1;
    opts.onProgress?.({ phase: "research", done, total: toResearch.length });
  });

  // PA step 6: cross-reference. Propagate a Confirmed RealCo to other issuers
  // that share an exact phone or a named individual, upgrading brand-family
  // SPVs (and self-copies) to their true operator.
  if (confirmedList.length > 0) {
    const byPhone = new Map<string, Confirmed>();
    const byPerson = new Map<string, Confirmed>();
    for (const c of confirmedList) {
      const pk = phoneKey(c.group.phone);
      if (pk.length >= 7) byPhone.set(pk, c);
      for (const person of c.group.persons) {
        if (!isEntity(person)) byPerson.set(person.toLowerCase(), c);
      }
    }

    for (const group of issuers) {
      // Skip issuers that were themselves confirmed by their own agent.
      if (confirmedList.some((c) => c.group.key === group.key)) continue;

      const pk = phoneKey(group.phone);
      let match = pk.length >= 7 ? byPhone.get(pk) : undefined;
      if (!match) {
        for (const person of group.persons) {
          if (isEntity(person)) continue;
          const hit = byPerson.get(person.toLowerCase());
          if (hit) {
            match = hit;
            break;
          }
        }
      }
      if (!match || match.group.key === group.key) continue;

      const current = rows[group.rowIndexes[0]]?.companyName ?? "";
      const parent = match.result.realCompany;
      if (parent && parent.toLowerCase() !== current.toLowerCase()) {
        applyToIssuer(rows, group, {
          companyName: parent,
          website: match.result.website,
          linkedIn: match.result.linkedIn,
          sources: sourceString(
            match.result.sourceFirm || parent,
            match.result.sourceUrl || match.result.website
          ),
        });
        stats.crossRefUpgrades += 1;
      }
    }
  }

  return stats;
}

/** Convenience: does this row set still match the pre-enrichment count? */
export function assertRowCount(before: number, after: ExportData): void {
  if (after.rows.length !== before) {
    throw new Error(
      `enrichment changed row count (${before} → ${after.rows.length})`
    );
  }
}
