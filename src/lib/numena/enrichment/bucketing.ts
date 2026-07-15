import type { IssuerGroup } from "@/lib/numena/prospect-csv";

/**
 * Primary-Agent deterministic classification (SOP Appendices A & B).
 *
 * Pure, reproducible: identical inputs → identical output, no network, no LLM.
 * The Primary Agent only needs a high-precision split between:
 *
 *   - "B"        — standalone / same-brand issuer → Company Name = itself
 *                  (deterministic self-copy, SOP step 3), and
 *   - "RESEARCH" — everything a Deep-Dive Agent must resolve (SOP buckets A & C,
 *                  which route to the same agent, so we don't split them here).
 *
 * When a signal is ambiguous we prefer RESEARCH: the Deep-Dive Agent verifies
 * against first-party sources, whereas a wrong self-copy silently mislabels an
 * SPV as its own operator.
 */

export type Bucket = "B" | "RESEARCH";

/** Tokens that mark a Prospect Name as an ENTITY, not a person (Appendix B). */
const ENTITY_TOKENS = new Set([
  "LLC", "L.L.C.", "LP", "L.P.", "LTD", "LTD.", "INC", "INC.", "CORP", "CORP.",
  "CO", "CO.", "COMPANY", "FUND", "FUNDS", "PARTNERS", "PARTNER", "CAPITAL",
  "MANAGEMENT", "MGMT", "GROUP", "ADVISOR", "ADVISORS", "ADVISER", "ADVISERS",
  "HOLDINGS", "VENTURES", "ENTERPRISES", "TRUST", "GP", "ASSOCIATES", "XCHANGE",
  "SERVICES", "DST", "INVESTORS", "EQUITY", "REALTY", "PROPERTIES", "BANK",
]);

/** Tokens that mean "fund vehicle", used to decide if an issuer is operating. */
const FUND_LIKE_TOKENS = new Set([
  "FUND", "FUNDS", "SPV", "LP", "L.P.", "PARTNERS", "CAPITAL", "GP", "TRUST",
  "DST", "VENTURES",
]);

/** Tokens that mark an issuer as an operating company (Appendix A, Bucket B). */
const OPERATING_TOKENS = new Set([
  "INC", "INC.", "CORP", "CORP.", "CORPORATION", "PLLC", "HOLDINGS",
]);

/** Suffix/role tokens stripped when deriving a brand root. */
const SUFFIX_TOKENS = new Set([
  ...ENTITY_TOKENS,
  "CORPORATION", "PLLC", "LLP", "PLC", "SA", "S.A.", "AG", "NV", "N.V.",
  "MANAGER", "MANAGERS", "SPV", "SUB",
]);

/** Short generic words that don't count as a distinctive brand root. */
const STOPWORDS = new Set(["THE", "A", "AN", "OF", "AND", "NEW", "US", "USA"]);

/**
 * Known fund administrators / formation platforms. When the ONLY entity signal
 * is one of these (no distinct sponsor), the issuer is ambiguous → RESEARCH.
 */
const ADMIN_FIRMS = [
  "BELLTOWER", "TRIBEVEST", "DECILE", "SYDECAR", "ASSURE", "VERIVEND",
  "CARTA", "ANGELLIST", "FLOW", "ALLOCATIONS", "VAULT", "REGATION",
];

const NA_PREFIX = /^(?:n\s*\/\s*a|n\\a|none|null)\b[\s.,-]*/i;

/** Strip a leading "n/a" / "none" / "null" placeholder from a name. */
export function stripNaPrefix(name: string): string {
  return name.replace(NA_PREFIX, "").trim();
}

/** Tokenize: split on spaces/commas, strip surrounding punctuation, uppercase. */
function tokenize(name: string): string[] {
  return name
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}.]+|[^\p{L}\p{N}.]+$/gu, "").toUpperCase())
    .filter(Boolean);
}

/** Appendix B: is this Prospect Name an ENTITY (vs a person)? Deterministic. */
export function isEntity(rawName: string): boolean {
  if (NA_PREFIX.test(rawName)) return true;
  const tokens = tokenize(rawName);
  return tokens.some((t) => ENTITY_TOKENS.has(t));
}

/** Does the (already na-stripped) entity name belong to a known administrator? */
function isAdminFirm(name: string): boolean {
  const upper = name.toUpperCase();
  return ADMIN_FIRMS.some((a) => upper.includes(a));
}

/** Leading distinctive brand token(s) of a name (up to two), suffixes removed. */
function brandRoot(name: string): string[] {
  const distinctive = tokenize(name).filter(
    (t) => !SUFFIX_TOKENS.has(t) && !STOPWORDS.has(t) && t.length >= 2
  );
  return distinctive.slice(0, 2);
}

/** Do two names share their leading distinctive brand token? */
function sharesBrandRoot(a: string, b: string): boolean {
  const ra = brandRoot(a);
  const rb = brandRoot(b);
  if (ra.length === 0 || rb.length === 0) return false;
  return ra[0] === rb[0];
}

/** Appendix A: is the issuer itself an operating company (not a fund vehicle)? */
function isOperatingIssuer(name: string): boolean {
  const tokens = tokenize(name);
  if (tokens.some((t) => OPERATING_TOKENS.has(t))) return true;
  const isLlc = tokens.includes("LLC") || tokens.includes("L.L.C.");
  const fundLike = tokens.some((t) => FUND_LIKE_TOKENS.has(t));
  return isLlc && !fundLike;
}

/** Signals surfaced for the Deep-Dive Agent's context (and cross-ref). */
export interface IssuerSignals {
  /** na-stripped management/GP entities named as associated persons. */
  managementEntities: string[];
  /** Named individuals among the associated persons. */
  individuals: string[];
  /** True when every entity signal is a known administrator only. */
  adminOnly: boolean;
  /** True when the issuer name reads as an operating company. */
  operatingIssuer: boolean;
}

/** Extract the Appendix-A signals from an issuer's associated persons. */
export function issuerSignals(group: IssuerGroup): IssuerSignals {
  const managementEntities: string[] = [];
  const individuals: string[] = [];
  for (const raw of group.persons) {
    const name = stripNaPrefix(raw);
    if (!name) continue;
    if (isEntity(raw)) managementEntities.push(name);
    else individuals.push(name);
  }
  const nonAdminEntities = managementEntities.filter((e) => !isAdminFirm(e));
  return {
    managementEntities,
    individuals,
    adminOnly:
      managementEntities.length > 0 && nonAdminEntities.length === 0,
    operatingIssuer: isOperatingIssuer(group.listedIssuer),
  };
}

/** Split associated persons into actual individuals vs named entities. */
export function splitPersons(persons: string[]): {
  individuals: string[];
  entities: string[];
} {
  const individuals: string[] = [];
  const entities: string[] = [];
  for (const raw of persons) {
    const name = stripNaPrefix(raw);
    if (!name) continue;
    if (isEntity(raw)) entities.push(name);
    else individuals.push(name);
  }
  return { individuals, entities };
}

/** A bucketing decision plus its reason and signals (for the DDA prompt). */
export interface Classification {
  bucket: Bucket;
  reason: string;
  signals: IssuerSignals;
}

/**
 * Classify one issuer group into B (self-copy) or RESEARCH (Deep-Dive Agent).
 * See the module doc for the precision bias. Fully deterministic.
 */
export function classifyIssuer(group: IssuerGroup): Classification {
  const signals = issuerSignals(group);
  const { managementEntities, individuals, adminOnly, operatingIssuer } =
    signals;

  // Self-copy WITHOUT research ONLY when the issuer is clearly a standalone
  // operating company with no separate management/GP entity named. This is the
  // one deterministic, always-correct case.
  if (
    managementEntities.length === 0 &&
    individuals.length > 0 &&
    operatingIssuer
  ) {
    return { bucket: "B", reason: "operating issuer, individuals only", signals };
  }

  // Everything else goes to a Deep-Dive Agent. Crucially this includes
  // *same-brand* fund families, because the true operator is often an acronym
  // or differently-named parent NOT on the filing (e.g. "MCG Wall … Fund" →
  // Madison Capital Group, "PRP Bakken …" → Purified Resource Partners). When
  // the agent can't confirm a distinct operator, the orchestrator falls back to
  // a self-copy of the Listed Issuer, matching the manual baseline.
  const hasMgmt = managementEntities.length > 0;
  const reason = hasMgmt
    ? adminOnly
      ? "administrator-only"
      : sharesBrandRoot(group.listedIssuer, managementEntities[0])
        ? "same-brand fund — resolve acronym/parent"
        : "differently-named management entity"
    : individuals.length > 0
      ? "fund shell, individuals only"
      : "no named persons";
  return { bucket: "RESEARCH", reason, signals };
}
