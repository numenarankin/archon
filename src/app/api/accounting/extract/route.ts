import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import { gateAI, meterAnthropic } from "@/lib/billing/credits";
import { getWells } from "@/lib/wells/wells";
import { getAccountingCategories } from "@/lib/accounting/org-categories";
import {
  ACCOUNTING_UPLOAD_BUCKET,
  isOwnedStorageKey,
} from "@/lib/accounting/storage";
import type { Category } from "@/lib/accounting/categories";

// OCR + reasoning over a document can take a while.
export const maxDuration = 120;

/** Schema the model fills per transaction — mirrors DraftTransaction. */
const txnSchema = z.object({
  kind: z.enum(["revenue", "expense"]),
  counterparty: z.string(),
  amount: z.number(),
  date: z.string(),
  category: z.string(),
  categoryCode: z.string(),
  invoiceNumber: z.string(),
  wellId: z.string(),
  volume: z.number().nullable(),
  price: z.number().nullable(),
  prodTax: z.number().nullable(),
  nri: z.number().nullable(),
});

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "file"; data: Uint8Array; mediaType: string }
  | { type: "image"; image: Uint8Array };

/** Builds the model content part(s) for an uploaded file by extension. */
function buildDocumentPart(name: string, buf: Buffer): ContentPart {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return { type: "file", data: new Uint8Array(buf), mediaType: "application/pdf" };
  }
  if (ext in IMAGE_TYPES) {
    return { type: "image", image: new Uint8Array(buf) };
  }
  if (ext === "csv") {
    return { type: "text", text: buf.toString("utf-8") };
  }
  if (ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(buf, { type: "buffer" });
    const text = wb.SheetNames.map(
      (sheet) =>
        `# Sheet: ${sheet}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheet])}`
    ).join("\n\n");
    return { type: "text", text };
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

function buildSystemPrompt(
  wells: { id: string; name: string }[],
  categories: Category[]
): string {
  const categoryList = categories
    .map((c) => `- ${c.code} — ${c.label} (${c.kind})`)
    .join("\n");
  const wellList = wells.map((w) => `- ${w.id} — ${w.name}`).join("\n") || "(none)";

  return [
    "You are an oil & gas accounting assistant. Extract every distinct financial",
    "transaction from the attached document into structured ledger entries.",
    "Make a best attempt at every field, but leave a field blank (\"\") or null",
    "when the document does not specify it — never invent values.",
    "",
    "Field rules:",
    "- dateReasoning: BEFORE listing transactions, write 1-3 sentences identifying",
    "  the document type (e.g. revenue/run statement, expense invoice, JIB, mixed),",
    "  the single governing date you will apply to each section, and exactly how you",
    "  derived it (for revenue: the production month you found, plus one). This field",
    "  is your scratchpad — reason here first so the per-row dates are consistent.",
    '- kind: "revenue" for money received, "expense" for money paid out.',
    "- amount: the positive net dollar amount.",
    "- date: ISO YYYY-MM-DD — the cash-basis month the entry belongs to.",
    "  A single document almost always covers ONE period. FIRST decide the governing",
    "  date for the document — and, if it mixes revenue and expenses, the governing",
    "  date for each section — then give EVERY transaction in that section the SAME",
    "  date. Do NOT vary the date line by line unless the document explicitly prints",
    "  a different date for a specific line. Think this through in `dateReasoning`",
    "  (see below) BEFORE you list any transactions.",
    "  The one-month offset below is REVENUE-ONLY. Expense dates are NEVER shifted,",
    "  forward or backward, under any circumstances.",
    "  REVENUE — derive the governing date in two steps, do NOT guess:",
    "    1. Find the PRODUCTION date in the revenue / settlement section of the",
    '       document — the month the oil or gas was actually produced or sold.',
    '       Look for labels like "Production Date", "Production Month",',
    '       "Production Period", "Sales Date", "Sales Month", "Prod Date", or a',
    "       production/accounting period column. Use ONLY a date from that",
    "       revenue section. Do NOT pick an unrelated date (check date, print",
    "       date, statement date, run/processed date) and hope it is correct — if",
    '       no production date is shown in the revenue section, leave date blank ("").',
    "    2. OFFSET that production date forward by exactly one calendar month and",
    "       output the result. Revenue checks are received the month AFTER",
    "       production, so production in April is recorded in May. Keep the same",
    "       day-of-month when a full date is given (e.g. production 2026-04-30 →",
    '       "2026-05-30"); if only a month is given with no day, use the first of',
    '       the following month (e.g. "April 2026" → "2026-05-01").',
    "  EXPENSE — copy the bill / invoice / billing / statement date VERBATIM (a bill",
    '       dated 05/31 → "2026-05-31"). NEVER offset an expense date, and never',
    "       apply the revenue production rule to an expense. If several dates appear,",
    "       use the invoice/billing/statement date, not a service-period or due date.",
    "- categoryCode + category: pick the single best fit from this list and use",
    "  BOTH the code and its exact label; otherwise leave both blank:",
    categoryList,
    "- wellId: match to one of these wells by name and use its id; blank if unclear:",
    wellList,
    "- counterparty: the payer (revenue) or recipient/vendor (expense).",
    "- invoiceNumber: the document/invoice number if present.",
    "- Revenue only — volume (units sold), price (per-unit), prodTax (production/",
    "  severance tax), nri (net revenue interest as a decimal). Use null for",
    "  expenses or when unknown.",
  ].join("\n");
}

export async function POST(req: Request) {
  // Everything runs inside one try so the handler ALWAYS responds with JSON.
  // An uncaught throw here (Supabase init, formData parsing, getWells) would
  // otherwise make Next render an HTML error page, and the client's
  // `res.json()` then fails with "Unexpected token '<', "<!DOCTYPE"...".
  try {
    // Capability gate: document extraction writes accounting drafts, so it
    // requires `manage_accounting` — enforced here, not just on the page.
    const denied = await forbidUnlessPermitted("manage_accounting");
    if (denied) return denied;

    const sb = await getSupabaseServer();
    const gate = await gateAI(sb);
    if (!gate.allowed) {
      return Response.json(
        { error: "ai_unavailable", reason: gate.reason },
        { status: 402 }
      );
    }

    // The file was streamed straight to private Storage by the browser (so it
    // bypasses the serverless request-body cap); we receive only a reference.
    const body = (await req.json().catch(() => null)) as
      | { storageKey?: unknown; fileName?: unknown }
      | null;
    const storageKey = typeof body?.storageKey === "string" ? body.storageKey : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    if (!storageKey || !fileName) {
      return Response.json(
        { error: "Missing storageKey or fileName" },
        { status: 400 }
      );
    }

    // Verify the key belongs to the caller's org before reading it with the
    // admin client (which bypasses RLS) — stops cross-org file reads.
    const { data: orgId } = await sb.rpc("current_org_id");
    if (!orgId || !isOwnedStorageKey(storageKey, orgId as string)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    let documentPart: ContentPart;
    try {
      const { data: blob, error: dlErr } = await getSupabaseAdmin()
        .storage.from(ACCOUNTING_UPLOAD_BUCKET)
        .download(storageKey);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message ?? "File not found in storage");
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      documentPart = buildDocumentPart(fileName, buf);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unreadable file" },
        { status: 400 }
      );
    }

    const [wellRows, categories] = await Promise.all([
      getWells(),
      getAccountingCategories(),
    ]);
    const wells = wellRows.map((w) => ({ id: w.id, name: w.name }));

    const { object, usage } = await generateObject({
      model: anthropic("claude-opus-4-8"),
      // Generous output ceiling: a statement can have many rows, and the
      // reason-first `dateReasoning` field adds text on top. Without this the
      // Anthropic provider defaults to a low cap (~4096), which truncates the
      // JSON on larger documents and makes generateObject throw.
      maxOutputTokens: 16000,
      // `dateReasoning` is first so the model commits to the document's governing
      // date(s) before emitting rows — a reason-first step that keeps per-row
      // dates consistent. It's consumed for its effect on `transactions`, not stored.
      schema: z.object({
        dateReasoning: z.string(),
        transactions: z.array(txnSchema),
      }),
      system: buildSystemPrompt(wells, categories),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all transactions from this document.",
            },
            documentPart,
          ],
        },
      ],
    });

    void meterAnthropic(
      { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      "accounting:extract",
      sb
    );

    return Response.json({ transactions: object.transactions });
  } catch (error) {
    console.error("Transaction extraction failed", error);
    // Surface the underlying cause (e.g. token truncation, model refusal,
    // schema-validation failure) so failures are diagnosable instead of opaque.
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json(
      { error: "Failed to extract transactions from the document.", detail },
      { status: 500 }
    );
  }
}
