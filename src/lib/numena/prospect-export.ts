"use server";

import { getProspectingClient } from "@/lib/numena/prospecting-supabase";
import { requirePermission } from "@/lib/auth/permissions";
import {
  fetchExportData,
  isIsoDate,
  rowsToCsv,
  type ExportFilters,
} from "@/lib/numena/prospect-csv";

/**
 * Cold-call CSV export for the Numena prospecting page.
 *
 * Emits one row **per related person** on each Form D filing whose filed date
 * falls in the requested range, oldest filing first. Six fields Archon owns are
 * populated — Filing date, Listed Issuer, Location, Time Zone, Company Phone,
 * Prospect Name — the rest blank, reserved for enrichment. Shape and helpers
 * live in `prospect-csv.ts`, shared with the enrichment pipeline.
 */

/** Result of an export run: the CSV text plus counts for the caller's toast. */
export interface ProspectExportResult {
  ok: boolean;
  /** CSV text (headers + rows), CRLF-terminated. Empty string on error. */
  csv: string;
  /** Distinct filings included. */
  filings: number;
  /** Person rows written (excludes the header). */
  rows: number;
  /** True when the filing cap was hit and the range was not fully scanned. */
  truncated: boolean;
  /** Human-readable reason when ok is false. */
  error?: string;
}

const EMPTY: ProspectExportResult = {
  ok: false,
  csv: "",
  filings: 0,
  rows: 0,
  truncated: false,
};

/**
 * Build the cold-call CSV for filings filed within `[dateFrom, dateTo]`
 * (inclusive, yyyy-mm-dd). One row per related person, oldest filing first.
 */
export async function exportProspectsCsv(
  dateFrom: string,
  dateTo: string,
  filters: ExportFilters = {}
): Promise<ProspectExportResult> {
  await requirePermission("view_prospects");

  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return { ...EMPTY, error: "Pick a valid start and end date." };
  }
  if (dateFrom > dateTo) {
    return { ...EMPTY, error: "Start date must be on or before end date." };
  }

  const sb = getProspectingClient();
  if (!sb) {
    return { ...EMPTY, error: "Prospecting data source is not configured." };
  }

  try {
    const { rows, filings, truncated } = await fetchExportData(
      sb,
      dateFrom,
      dateTo,
      filters
    );
    return {
      ok: true,
      csv: rowsToCsv(rows),
      filings,
      rows: rows.length,
      truncated,
    };
  } catch (err) {
    console.error("[numena] exportProspectsCsv failed:", err);
    return { ...EMPTY, error: "Export query failed. Try a smaller range." };
  }
}
