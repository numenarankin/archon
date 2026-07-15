import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateText, stepCountIs, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { splitPersons } from "@/lib/numena/enrichment/bucketing";

/**
 * Deep-Dive Agent (DDA) — one independent research worker per issuer the
 * Primary Agent could not resolve deterministically (SOP buckets A & C).
 *
 * Each call is its own agent: a `claude-opus-4-8` model with Anthropic's hosted
 * `web_search` tool, told to resolve the operating firm (RealCo) behind a Form D
 * shell and return first-party evidence. It enforces the SOP's "verified or
 * bust" rule — it must corroborate against a hard signal (HQ/location match,
 * exact phone match, or a named associated person confirmed as the firm's
 * principal) and must never invent a URL. Unconfirmable → confidence
 * "Unverified" with empty fields, so the orchestrator leaves those cells blank.
 */

const DDA_MODEL = "claude-opus-4-8";

/** Structured result the agent must return. Empty strings mean "not found". */
const DeepDiveSchema = z.object({
  realCompany: z
    .string()
    .describe(
      "The operating firm actually behind the raise (goes in Company Name). Empty string if not confidently identified."
    ),
  website: z
    .string()
    .describe("Official first-party homepage URL, or empty string. Never guess."),
  linkedIn: z
    .string()
    .describe("Official company LinkedIn URL, or empty string. Never guess."),
  confidence: z
    .enum(["Confirmed", "Probable", "Unverified"])
    .describe(
      "Confirmed = first-party/filing corroborated by a hard signal; Probable = named but not first-party confirmed; Unverified = could not confirm."
    ),
  evidence: z
    .string()
    .describe(
      "What corroborated it: phone match, HQ/address match, a person's employer, or filing text. Empty if none."
    ),
  sourceFirm: z
    .string()
    .describe("Provenance: the source's name (e.g. the firm's site, SEC). Empty if none."),
  sourceUrl: z
    .string()
    .describe("Provenance: the source URL. Must be a real page you consulted. Empty if none."),
});

export type DeepDiveResult = z.infer<typeof DeepDiveSchema>;

/** Everything the agent gets about one issuer to research. */
export interface DeepDiveInput {
  listedIssuer: string;
  location: string;
  phone: string;
  /** All associated Prospect Names (individuals + management entities). */
  persons: string[];
  /** Optional PA hint about why this issuer needs research. */
  hint?: string;
}

const SYSTEM = [
  "You are a securities-research analyst identifying the real operating firm (RealCo) behind a Reg D (Form D) filing. The Listed Issuer is usually a special-purpose vehicle (SPV); find the operating firm/manager actually running the raise.",
  "Follow THIS METHOD — it is person-centric on purpose, because a firm NAME listed among the associated persons can be a false positive (a captive GP shell, a fund administrator, or an unrelated entity). Do not take such names at face value; use them only to verify.",
  "STEP 1 — People: from the associated persons, take the ACTUAL INDIVIDUALS (real human names, not entities).",
  "STEP 2 — Employer search: search each individual TOGETHER WITH the filing city/location to find the firm they work for. The city narrows candidates dramatically — always include it (e.g. 'Jane Doe <City> <ST>').",
  "STEP 3 — Consensus: the firm that ALL or MOST of those individuals share is the likely RealCo. One person can mislead; agreement across several is strong.",
  "STEP 4 — Connect to the issuer: you may only accept the consensus firm if you can tie it to the Listed Issuer through at least one of: an acronym/abbreviation match (issuer initials expand to the firm, e.g. 'PRP Bakken' → Purified Resource Partners, 'USEDC' → U.S. Energy Development Corporation), the firm appearing when you search the Listed Issuer or its associated companies, an associated company on the filing that matches the firm, or an exact phone/HQ-location match.",
  "STEP 5 — Cross-reference: also search (a) the Listed Issuer name, (b) the individuals, and (c) any associated companies, looking for one firm that all three point to.",
  "Use FIRST-PARTY / official sources to confirm (the firm's site, its team/IR/press page, SEC/EDGAR, the person's verified employer page). Never output a URL you did not open.",
  "DECISION: return the firm ONLY if person-consensus AND a connection to the Listed Issuer both hold — 'Confirmed' for a hard connection (phone/HQ/acronym/named-company match), 'Probable' for solid person-consensus with a softer connection. If you cannot connect a firm to this issuer, return realCompany EMPTY with confidence 'Unverified' — do NOT guess and do NOT echo the issuer's own name.",
  "realCompany must be a clean legal/brand name ONLY (e.g. 'Purified Resource Partners') — never a sentence, explanation, or reasoning. Put all reasoning in 'evidence'.",
].join(" ");

function buildPrompt(input: DeepDiveInput): string {
  const { individuals, entities } = splitPersons(input.persons);
  const list = (xs: string[]) =>
    xs.length ? xs.map((p) => `  - ${p}`).join("\n") : "  (none)";
  return [
    `Listed Issuer: ${input.listedIssuer}`,
    `City / Location: ${input.location || "(unknown)"}   <-- use this in every person search`,
    `Company Phone: ${input.phone || "(unknown)"}`,
    `Actual individuals (search these + the city for their employer):`,
    list(individuals),
    `Named entities/companies on the filing (verify only — may be false positives):`,
    list(entities),
    input.hint ? `\nPrimary-Agent note: ${input.hint}.` : "",
    "\nApply the method: find the firm the individuals share, then connect it to the Listed Issuer. Return realCompany = a clean firm name only, or empty + 'Unverified' if you cannot connect one.",
  ].join("\n");
}

const EMPTY_RESULT: DeepDiveResult = {
  realCompany: "",
  website: "",
  linkedIn: "",
  confidence: "Unverified",
  evidence: "",
  sourceFirm: "",
  sourceUrl: "",
};

/** Research budget per agent. Higher = better recall, more cost/latency. */
const MAX_SEARCH_USES = 6;
const MAX_STEPS = 10;
/** Bump when SYSTEM/prompt/schema change so the on-disk cache invalidates. */
const CACHE_VERSION = 5;

/**
 * Run one Deep-Dive Agent for a single issuer. Never throws — on any error
 * (rate limit, timeout, malformed output) it resolves to an Unverified empty
 * result so the pipeline keeps the issuer's rows and simply leaves them blank.
 *
 * When `ENRICH_CACHE_DIR` is set (offline evaluation only), results are cached
 * on disk keyed by the exact prompt, so re-runs are free unless the prompt
 * changes. The cache is inert in production (env unset).
 */
export async function runDeepDive(
  input: DeepDiveInput,
  signal?: AbortSignal
): Promise<DeepDiveResult> {
  const prompt = buildPrompt(input);
  const cached = readCache(prompt);
  if (cached) return cached;

  const result = await withRetry(async () => {
    const { experimental_output } = await generateText({
      model: anthropic(DDA_MODEL),
      abortSignal: signal,
      system: SYSTEM,
      prompt,
      tools: {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: MAX_SEARCH_USES }),
      },
      stopWhen: stepCountIs(MAX_STEPS),
      experimental_output: Output.object({ schema: DeepDiveSchema }),
    });
    return normalize(experimental_output);
  }, input.listedIssuer);

  if (result.confidence !== "Unverified" || result.evidence !== "agent error") {
    writeCache(prompt, result);
  }
  return result;
}

/** Retry transient failures (rate limits, overloaded) a couple of times. */
async function withRetry(
  fn: () => Promise<DeepDiveResult>,
  label: string
): Promise<DeepDiveResult> {
  const delays = [1500, 4000, 9000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /rate|overload|429|529|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(
        msg
      );
      if (!transient || attempt === delays.length) {
        console.error(`[numena] deep-dive failed for "${label}":`, msg);
        return { ...EMPTY_RESULT, evidence: "agent error" };
      }
      await sleep(delays[attempt]);
    }
  }
  return { ...EMPTY_RESULT, evidence: "agent error" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * A clean company name is short and free of prose. If the model's reasoning
 * leaked into `realCompany` (a known rough edge of structured output + tool
 * use), reject it outright rather than write garbage into the sheet.
 */
function looksLikeProse(value: string): boolean {
  if (value.length > 70) return true;
  // Reasoning/markup/source artifacts that never appear in a real firm name.
  if (/[<>{}]|https?:\/\/|source:|confirm|\bmatch\b|\bSPV\b|\.\s|\n/i.test(value)) {
    return true;
  }
  // A real name is a few words; a sentence is many.
  if (value.split(/\s+/).length > 9) return true;
  // A real name starts with a letter or digit — never a lowercase sentence
  // fragment ("the Reonym.") or leading punctuation (", the", "> …").
  if (!/^[A-Za-z0-9]/.test(value)) return true;
  if (/^[a-z]/.test(value)) return true;
  // Must contain at least a couple of real letters, not a stray fragment.
  if (value.replace(/[^A-Za-z]/g, "").length < 3) return true;
  return false;
}

/** Trim fields, drop leaked-reasoning names, enforce URL/first-party hygiene. */
function normalize(r: DeepDiveResult): DeepDiveResult {
  const out: DeepDiveResult = {
    realCompany: r.realCompany?.trim() ?? "",
    website: r.website?.trim() ?? "",
    linkedIn: r.linkedIn?.trim() ?? "",
    confidence: r.confidence ?? "Unverified",
    evidence: r.evidence?.trim() ?? "",
    sourceFirm: r.sourceFirm?.trim() ?? "",
    sourceUrl: r.sourceUrl?.trim() ?? "",
  };
  // Corruption guard: a company name that reads like prose is not usable.
  if (out.realCompany && looksLikeProse(out.realCompany)) {
    return { ...EMPTY_RESULT, evidence: "rejected: non-name output" };
  }
  // A URL that isn't http(s) is not first-party evidence — drop it.
  if (!/^https?:\/\//i.test(out.website)) out.website = "";
  if (!/^https?:\/\//i.test(out.linkedIn)) out.linkedIn = "";
  if (out.sourceUrl && !/^https?:\/\//i.test(out.sourceUrl)) out.sourceUrl = "";
  // Confirmed must carry a real company name; otherwise it's not confirmed.
  if (out.confidence === "Confirmed" && !out.realCompany) {
    out.confidence = "Unverified";
  }
  return out;
}

// ── On-disk prompt cache (offline evaluation only) ────────────────────────

function cachePath(prompt: string): string | null {
  const dir = process.env.ENRICH_CACHE_DIR;
  if (!dir) return null;
  const key = createHash("sha256")
    .update(`${DDA_MODEL} ${CACHE_VERSION} ${SYSTEM} ${prompt}`)
    .digest("hex");
  return join(dir, `${key}.json`);
}

function readCache(prompt: string): DeepDiveResult | null {
  const path = cachePath(prompt);
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DeepDiveResult;
  } catch {
    return null;
  }
}

function writeCache(prompt: string, result: DeepDiveResult): void {
  const path = cachePath(prompt);
  if (!path) return;
  try {
    mkdirSync(process.env.ENRICH_CACHE_DIR as string, { recursive: true });
    writeFileSync(path, JSON.stringify(result));
  } catch {
    /* cache is best-effort */
  }
}
