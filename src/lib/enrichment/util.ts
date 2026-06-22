/**
 * Small pure helpers for the enrichment pipeline: safe coercion of untrusted
 * scraper output, name parsing/comparison, and the person dedup key.
 */

/** Trimmed non-empty string, or null. */
export function str(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  return null;
}

/** Finite number from a number or numeric string, or null. */
export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

/** Boolean from a boolean or "true"/"false" string, or null. */
export function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/** Digits only (E.164 and formatting stripped); null if none. */
export function digits(v: unknown): string | null {
  const s = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  const d = s.replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

/** Last 10 digits, so +1 / leading-1 variants of the same number compare equal. */
export function phoneKey(v: unknown): string | null {
  const d = digits(v);
  if (!d) return null;
  return d.length > 10 ? d.slice(-10) : d;
}

/** Lowercased alphabetic-only form for loose name/string comparison. */
export function normName(v: unknown): string {
  return (typeof v === "string" ? v : "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Parse a P-5 officer name ("LAST, FIRST MIDDLE") into first/last. Falls back to
 * "FIRST LAST" order when there is no comma.
 */
export function parseOfficerName(name: string): {
  first: string | null;
  last: string | null;
} {
  const comma = name.indexOf(",");
  if (comma >= 0) {
    const last = name.slice(0, comma).trim();
    const rest = name.slice(comma + 1).trim();
    const first = rest.split(/\s+/)[0] ?? "";
    return { first: first || null, last: last || null };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  return { first: null, last: parts[0] || null };
}

/** Dedup/cache key: a person is the same across the operators they appear on. */
export function personKey(name: string, phone: string | null): string {
  const { first, last } = parseOfficerName(name);
  return `${normName(last)}|${normName(first)}|${phoneKey(phone) ?? ""}`;
}

/**
 * Does a scraper candidate's full name plausibly match our officer? Requires the
 * last name to appear and the first name (or its initial) to agree. Tolerant of
 * "First Last" vs "Last, First" ordering and middle names.
 */
export function nameMatches(
  first: string | null,
  last: string | null,
  candidateFullName: string | null
): boolean {
  if (!last || !candidateFullName) return false;
  const tokens = candidateFullName
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return false;
  const ln = normName(last);
  const hasLast = tokens.some((t) => t === ln);
  if (!hasLast) return false;
  if (!first) return true; // last-only is weak but allowed; scoring handles it
  const fn = normName(first);
  return tokens.some((t) => t === fn || (t.length === 1 && t === fn[0]) || t[0] === fn[0]);
}

/** Coarse address corroboration: does the candidate address contain our city or ZIP. */
export function addressMatches(
  candidateAddress: string | null,
  city: string | null,
  zip: number | null
): boolean {
  if (!candidateAddress) return false;
  const hay = candidateAddress.toLowerCase();
  if (city && hay.includes(city.toLowerCase().trim())) return true;
  if (zip && hay.includes(String(zip))) return true;
  return false;
}

const OILGAS = ["oil", "gas", "petroleum", "energy", "operating", "resources"];

/** Employer matches the operator name, or occupation is oil-and-gas flavored. */
export function employerMatches(
  employer: string | null,
  occupation: string | null,
  operatorName: string | null
): boolean {
  const emp = (employer ?? "").toLowerCase();
  const occ = (occupation ?? "").toLowerCase();
  if (operatorName) {
    // First significant token of the operator name appearing in the employer.
    const tok = operatorName.toLowerCase().split(/[\s,.]+/).find((t) => t.length > 3);
    if (tok && emp.includes(tok)) return true;
  }
  return OILGAS.some((k) => occ.includes(k) || emp.includes(k));
}
