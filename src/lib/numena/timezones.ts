/**
 * US state / territory → predominant time-zone label, for showing an issuer's
 * likely local time on the prospecting table.
 *
 * States that span more than one zone (e.g. TX, FL, ID, KY) are mapped to the
 * zone covering most of their population, so treat this as an approximation
 * rather than an exact per-address lookup.
 */
const STATE_TIMEZONES: Record<string, string> = {
  // Eastern
  CT: "ET",
  DE: "ET",
  DC: "ET",
  FL: "ET",
  GA: "ET",
  IN: "ET",
  KY: "ET",
  ME: "ET",
  MD: "ET",
  MA: "ET",
  MI: "ET",
  NH: "ET",
  NJ: "ET",
  NY: "ET",
  NC: "ET",
  OH: "ET",
  PA: "ET",
  RI: "ET",
  SC: "ET",
  VT: "ET",
  VA: "ET",
  WV: "ET",
  // Central
  AL: "CT",
  AR: "CT",
  IL: "CT",
  IA: "CT",
  KS: "CT",
  LA: "CT",
  MN: "CT",
  MS: "CT",
  MO: "CT",
  NE: "CT",
  ND: "CT",
  OK: "CT",
  SD: "CT",
  TN: "CT",
  TX: "CT",
  WI: "CT",
  // Mountain (AZ does not observe DST for most of the year)
  AZ: "MT",
  CO: "MT",
  ID: "MT",
  MT: "MT",
  NM: "MT",
  UT: "MT",
  WY: "MT",
  // Pacific
  CA: "PT",
  NV: "PT",
  OR: "PT",
  WA: "PT",
  // Alaska / Hawaii
  AK: "AKT",
  HI: "HT",
  // Territories
  PR: "AT",
  VI: "AT",
  GU: "ChST",
  MP: "ChST",
  AS: "SST",
};

/**
 * The predominant US time zone for a two-letter state/territory code, or "—"
 * when the state is missing or not a recognized US code (e.g. foreign issuers).
 */
export function timezoneForState(state: string | null | undefined): string {
  const code = state?.trim().toUpperCase();
  if (!code) return "—";
  return STATE_TIMEZONES[code] ?? "—";
}
