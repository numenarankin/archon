import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import { getProspectingClient } from "@/lib/numena/prospecting-supabase";
import {
  fetchExportData,
  isIsoDate,
  rowsToCsv,
  type ExportFilters,
} from "@/lib/numena/prospect-csv";
import { enrichRows, assertRowCount } from "@/lib/numena/enrichment/orchestrator";

/**
 * Enriched cold-call export (SOP pipeline). Runs entirely in memory for one
 * request: load the same rows as the plain export, run the Primary Agent +
 * Deep-Dive Agent enrichment, and stream NDJSON progress followed by the final
 * enriched CSV. No persistence — if a very wide range times out, the caller
 * already has the plain CSV and can narrow the range.
 */

// web_search + server-only modules need the Node runtime, and the multi-agent
// research needs well beyond the default budget.
export const runtime = "nodejs";
export const maxDuration = 300;

interface EnrichBody {
  dateFrom?: string;
  dateTo?: string;
  filters?: ExportFilters;
}

export async function POST(req: Request): Promise<Response> {
  const denied = await forbidUnlessPermitted("view_prospects");
  if (denied) return denied;

  let body: EnrichBody;
  try {
    body = (await req.json()) as EnrichBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { dateFrom, dateTo, filters } = body;
  if (!dateFrom || !dateTo || !isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return Response.json({ error: "Pick a valid start and end date." }, { status: 400 });
  }
  if (dateFrom > dateTo) {
    return Response.json(
      { error: "Start date must be on or before end date." },
      { status: 400 }
    );
  }

  const sb = getProspectingClient();
  if (!sb) {
    return Response.json(
      { error: "Prospecting data source is not configured." },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const data = await fetchExportData(sb, dateFrom, dateTo, filters);
        const before = data.rows.length;

        if (before === 0) {
          send({ type: "error", error: "No prospects found in that range." });
          return;
        }

        send({ type: "start", rows: before, issuers: data.issuers.length });

        const stats = await enrichRows(data, {
          concurrency: 8,
          signal: req.signal,
          onProgress: (p) => send({ type: "progress", ...p }),
        });

        // Inclusion invariant: enrichment only fills cells, never drops a row.
        assertRowCount(before, data);

        send({
          type: "done",
          csv: rowsToCsv(data.rows, { sources: true }),
          rows: data.rows.length,
          filings: data.filings,
          truncated: data.truncated,
          stats,
        });
      } catch (err) {
        console.error("[numena] enrich route failed:", err);
        send({
          type: "error",
          error:
            err instanceof Error && req.signal.aborted
              ? "Enrichment cancelled."
              : "Enrichment failed. Try a smaller range.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
