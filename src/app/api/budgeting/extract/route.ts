import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import { getBudgetCategories, type Category } from "@/lib/budgeting/categories";
import { BUDGET_UPLOAD_BUCKET } from "@/lib/budgeting/storage";

// OCR + reasoning over a document can take a while.
export const maxDuration = 120;

/** Schema the model fills per transaction — mirrors DraftTransaction. */
const txnSchema = z.object({
  kind: z.enum(["income", "expense"]),
  payee: z.string(),
  amount: z.number(),
  date: z.string(),
  category: z.string(),
  categoryCode: z.string(),
  note: z.string(),
  account: z.string(),
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
    return {
      type: "file",
      data: new Uint8Array(buf),
      mediaType: "application/pdf",
    };
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

function buildSystemPrompt(categories: Category[]): string {
  const categoryList = categories
    .map((c) => `- ${c.code} — ${c.label} (${c.kind})`)
    .join("\n");

  return [
    "You are a personal-finance assistant. Extract every distinct transaction",
    "from the attached document (a bank or credit-card statement, a receipt, or",
    "an invoice) into structured ledger entries. Make a best attempt at every",
    'field, but leave a field blank ("") when the document does not specify it —',
    "never invent values.",
    "",
    "Field rules:",
    '- kind: "income" for money received, "expense" for money paid out. On a card',
    "  or bank statement, purchases/charges/debits are expenses; deposits,",
    "  payments received, credits, and refunds are income.",
    "- amount: the positive dollar amount, with no sign.",
    "- date: ISO YYYY-MM-DD — the date printed for that specific line item. Copy",
    "  each line's own date verbatim; never shift or offset it.",
    "- payee: the merchant or recipient (expense), or the source/payer (income).",
    "- categoryCode + category: pick the single best fit from this list and use",
    "  BOTH the code and its exact label; otherwise leave both blank:",
    categoryList,
    '- account: the account name or nickname the document shows (e.g. a card name',
    '  or the last 4 digits), else "".',
    '- note: any memo, reference, or confirmation/invoice number worth keeping,',
    '  else "".',
  ].join("\n");
}

export async function POST(req: Request) {
  // Everything runs inside one try so the handler ALWAYS responds with JSON.
  try {
    // Document extraction spends AI credits, so it requires `use_ai`.
    const denied = await forbidUnlessPermitted("use_ai");
    if (denied) return denied;

    const sb = await getSupabaseServer();

    // The file was streamed straight to private Storage by the browser; we
    // receive only a reference.
    const body = (await req.json().catch(() => null)) as
      | { storageKey?: unknown; fileName?: unknown }
      | null;
    const storageKey =
      typeof body?.storageKey === "string" ? body.storageKey : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    if (!storageKey || !fileName) {
      return Response.json(
        { error: "Missing storageKey or fileName" },
        { status: 400 }
      );
    }

    // The object is fetched with the RLS-bypassing admin client below, so verify
    // the key belongs to the caller first. budget-uploads keys are namespaced
    // `<owner_id>/<uuid>`; without this any user could extract another's upload.
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user || !storageKey.startsWith(`${user.id}/`)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    let documentPart: ContentPart;
    try {
      const { data: blob, error: dlErr } = await getSupabaseAdmin()
        .storage.from(BUDGET_UPLOAD_BUCKET)
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

    const categories = getBudgetCategories();

    const { object, usage } = await generateObject({
      model: anthropic("claude-opus-4-8"),
      // Generous output ceiling: a statement can have many rows. Without this the
      // Anthropic provider defaults to a low cap (~4096), which truncates the
      // JSON on larger documents and makes generateObject throw.
      maxOutputTokens: 16000,
      schema: z.object({
        transactions: z.array(txnSchema),
      }),
      system: buildSystemPrompt(categories),
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

    return Response.json({ transactions: object.transactions });
  } catch (error) {
    console.error("Transaction extraction failed", error);
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json(
      { error: "Failed to extract transactions from the document.", detail },
      { status: 500 }
    );
  }
}
