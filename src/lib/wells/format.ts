// Shared display helpers for the well/operator detail panels.

/** 8-digit zero-padded API string. */
export function api8(n: number): string {
  return String(n).padStart(8, "0");
}

/** CCYYMMDD integer -> "YYYY-MM-DD" (null for 0/empty). */
export function fmtDate8(n: number | null | undefined): string | null {
  if (!n) return null;
  const s = String(n).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** 10-digit phone integer -> "(NPA) NXX-XXXX" (null for 0/empty). */
export function fmtPhone(n: number | null | undefined): string | null {
  if (!n) return null;
  const s = String(n).padStart(10, "0");
  if (s.length !== 10) return String(n);
  return `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}`;
}

/** Production volume -> compact string (e.g. 437M, 3.4K, 0). Null/0 -> "0". */
export function fmtVol(n: number | null | undefined): string {
  if (!n) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** RRC P-5 organization status codes. */
export const P5_STATUS: Record<string, string> = {
  A: "Active",
  I: "Inactive",
  D: "Delinquent",
  X: "Active (extension)",
  H: "Active (hearing)",
  R: "Revoked",
  S: "See remarks",
};
