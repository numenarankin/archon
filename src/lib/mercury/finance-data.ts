import "server-only";

import { fetchFinanceData } from "@/lib/mercury/finance";
import type { FinanceData } from "@/lib/mercury/types";
import { MOCK_FINANCE_DATA } from "@/lib/mercury/mocks";

/**
 * One call for the /finance page. Chooses between live Mercury data and the mock
 * fixture based on env presence, so dev without a token still renders.
 *
 * Env vars:
 *   MERCURY_API_KEY     — required for live mode (format: "secret-token:mercury_...")
 *   MERCURY_SANDBOX     — set to "true" to hit api-sandbox.mercury.com
 *   MERCURY_REVALIDATE  — fetch cache seconds, or "no-store" (default "no-store")
 */
export async function getFinanceData(): Promise<FinanceData> {
  const apiKey = process.env.MERCURY_API_KEY;
  if (!apiKey) return MOCK_FINANCE_DATA;

  const sandbox = process.env.MERCURY_SANDBOX === "true";
  const rawRevalidate = process.env.MERCURY_REVALIDATE;
  const revalidate: number | "no-store" = rawRevalidate
    ? rawRevalidate === "no-store"
      ? "no-store"
      : Number(rawRevalidate)
    : "no-store";

  try {
    return await fetchFinanceData({ apiKey, sandbox, revalidate });
  } catch (err) {
    // Surface for the server log; fall back to mocks so the page still renders.
    console.error("[finance] Mercury fetch failed, falling back to mocks:", err);
    return MOCK_FINANCE_DATA;
  }
}
