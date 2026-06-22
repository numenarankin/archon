/**
 * Progressive US phone-number formatting for controlled text inputs.
 *
 * Formats the digits the user has typed so far into `(555) 123-4567`, growing
 * as they type. Non-digits are ignored and input is capped at 10 digits, so the
 * field can never hold more than a complete US number. A leading country-code
 * `1` is dropped so pasting `1 (555) 123-4567` still lands on 10 digits.
 */
export function formatUsPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Drop a leading US country code so an 11-digit paste normalizes to 10.
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
