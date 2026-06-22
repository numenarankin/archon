import { hasSupabase } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { embedText, embedTexts } from "@/lib/ai/embeddings";
import { ocrDocument } from "@/lib/ai/ocr";
import { chunkProse, type ProseChunk } from "@/lib/kb/chunking";
import { summariseStructured } from "@/lib/kb/parsers/structured";

const BUCKET = "files";

/**
 * Make ONE file searchable, whatever it is. Reads its text — inline `content`,
 * existing OCR `derived_content`, or, for a PDF/image with stored bytes but no
 * text yet, runs OCR first and saves the result. Then indexes it in
 * `document_chunks`, dispatching on the kind of file:
 *
 *  - Structured data (LAS well logs, CSV/TSV) is parsed into a header +
 *    per-curve/column summary; that SUMMARY is embedded (not the raw numbers),
 *    and the parsed payload is cached on `files.structured_summary` for tools.
 *  - Everything else is chunked with structure-aware, contextual chunking
 *    (see lib/kb/chunking.ts).
 *
 * This is the single entry point every write path calls so that EVERY document
 * is indexed: authored docs, edited docs, text uploads, structured data, and
 * OCR'd binaries.
 */
export async function embedFile(fileId: string): Promise<void> {
  if (!hasSupabase()) return;
  // DB ops run as the signed-in user so RLS scopes them and new chunks inherit
  // the caller's org_id; storage bytes are read with the admin client (private
  // bucket), gated by the RLS-checked `files` read above.
  const sb = await getSupabaseServer();

  const { data: file } = await sb
    .from("files")
    .select("id, type, mime, name, content, derived_content, storage_key")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return;

  let text = (file.content || file.derived_content || "").trim();

  // No text yet but we have stored bytes for a PDF/image → OCR it, persist the
  // derived text, and index that.
  if (!text && file.storage_key && (file.type === "pdf" || file.type === "image")) {
    const { data: blob, error: dlErr } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .download(file.storage_key);
    if (!dlErr && blob) {
      const ocr = await ocrDocument(
        await blob.arrayBuffer(),
        file.mime ?? null,
        file.name
      );
      if (ocr) {
        await sb
          .from("files")
          .update({ derived_content: ocr, derived_at: new Date().toISOString() })
          .eq("id", fileId);
        text = ocr;
      }
    }
  }

  // Replace existing chunks.
  await sb.from("document_chunks").delete().eq("file_id", fileId);
  if (!text) return;

  // Structured data (LAS / CSV): embed the parsed summary, cache the payload.
  const structured = summariseStructured(file.name, text);
  let chunks: ProseChunk[];
  if (structured) {
    await sb
      .from("files")
      .update({ structured_summary: structured.payload })
      .eq("id", fileId);
    chunks = chunkProse(structured.summaryText, { title: file.name });
  } else {
    chunks = chunkProse(text, { title: file.name });
  }
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks.map((c) => c.content));
  const rows = chunks.map((c, i) => ({
    file_id: fileId,
    chunk_index: i,
    content: c.content,
    embedding: embeddings[i],
    metadata: {
      type: file.type,
      ...(structured ? { kind: structured.kind, structured: true } : {}),
      ...(c.section ? { section: c.section } : {}),
    },
  }));

  const { error } = await sb.from("document_chunks").insert(rows);
  if (error) throw new Error(`embedFile: ${error.message}`);
}

export interface DocMatch {
  fileId: string;
  fileName: string;
  content: string;
  score: number;
}

/**
 * Hybrid (semantic + keyword) search over the document corpus. When `folderId`
 * is given, retrieval is scoped to documents placed in that folder (an
 * project); otherwise it searches the whole corpus.
 */
export async function searchDocuments(
  query: string,
  limit = 8,
  folderId?: string | null
): Promise<DocMatch[]> {
  if (!hasSupabase() || !query.trim()) return [];
  // Request-scoped so the match RPC runs as the user and RLS scopes results to
  // documents they can access.
  const sb = await getSupabaseServer();

  const embedding = await embedText(query);
  const { data, error } = await sb.rpc("match_document_chunks", {
    query_embedding: embedding,
    query_text: query,
    match_count: limit,
    folder_ids: folderId ? [folderId] : null,
  });
  if (error) throw new Error(`searchDocuments: ${error.message}`);

  const rows = (data ?? []) as {
    file_id: string;
    content: string;
    score: number;
  }[];
  if (rows.length === 0) return [];

  // Attach file names for citations.
  const fileIds = [...new Set(rows.map((r) => r.file_id))];
  const { data: files } = await sb
    .from("files")
    .select("id, name")
    .in("id", fileIds);
  const nameById = new Map((files ?? []).map((f) => [f.id, f.name]));

  return rows.map((r) => ({
    fileId: r.file_id,
    fileName: nameById.get(r.file_id) ?? "unknown",
    content: r.content,
    score: r.score,
  }));
}
