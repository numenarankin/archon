"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getFileTags,
  getGraph,
  getOutgoingCitations,
  searchFilesForMention,
  searchTags,
  tagSlug,
} from "@/lib/kb/graph";
import type {
  BridgeKind,
  GraphAuthor,
  GraphData,
  MentionCandidate,
  Tag,
} from "@/lib/kb/types";

// ── Reads exposed to client components ───────────────────────────────────────

/** Load the bridge/tag graph for a project folder (or whole corpus). */
export async function loadGraph(folderId?: string | null): Promise<GraphData> {
  return getGraph(folderId);
}

/** Name search for the editor's @-mention picker. */
export async function findMentionCandidates(
  query: string,
  folderId?: string | null,
  excludeFileId?: string
): Promise<MentionCandidate[]> {
  return searchFilesForMention(query, folderId, excludeFileId);
}

/** Tags applied to a file. */
export async function loadFileTags(fileId: string): Promise<Tag[]> {
  return getFileTags(fileId);
}

/** A file's outgoing citations (bridge id + target name) for editor list UIs. */
export async function loadOutgoingCitations(
  fileId: string
): Promise<{ id: string; targetFileId: string; name: string; kind: BridgeKind }[]> {
  return getOutgoingCitations(fileId);
}

/** Tag name search for the tag picker. */
export async function findTags(prefix: string): Promise<Tag[]> {
  return searchTags(prefix);
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Add a tag to a file. Upserts the tag by its normalized slug so casing/spacing
 * variants collapse to one topic, then links it to the file. `createdBy` records
 * whether a person or the AI added it.
 */
export async function addTag(
  fileId: string,
  name: string,
  createdBy: GraphAuthor = "user"
): Promise<Tag | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = tagSlug(trimmed);
  if (!slug) return null;
  const sb = await getSupabaseServer();

  const { data: tag, error: tagErr } = await sb
    .from("tags")
    .upsert({ name: trimmed, slug }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  if (tagErr) throw new Error(`addTag (tag): ${tagErr.message}`);

  const { error: linkErr } = await sb
    .from("file_tags")
    .upsert(
      { file_id: fileId, tag_id: tag.id, created_by: createdBy },
      { onConflict: "file_id,tag_id" }
    );
  if (linkErr) throw new Error(`addTag (link): ${linkErr.message}`);

  revalidatePath("/files");
  return { id: tag.id, name: tag.name, slug: tag.slug };
}

/** Remove a tag from a file (leaves the tag row for other files). */
export async function removeTag(fileId: string, tagId: string): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("file_tags")
    .delete()
    .eq("file_id", fileId)
    .eq("tag_id", tagId);
  if (error) throw new Error(`removeTag: ${error.message}`);
  revalidatePath("/files");
}

/**
 * Create a bridge directly (used by the AI on explicit request, and available
 * for programmatic links). Editor-authored citations are persisted by
 * `syncBridgesFromContent` instead. AI bridges carry no anchor.
 */
export async function addBridge(
  sourceFileId: string,
  targetFileId: string,
  kind: BridgeKind = "cite",
  options: { anchor?: string; note?: string; createdBy?: GraphAuthor } = {}
): Promise<void> {
  if (sourceFileId === targetFileId) {
    throw new Error("addBridge: a document cannot cite itself");
  }
  const sb = await getSupabaseServer();
  const row = {
    source_file_id: sourceFileId,
    target_file_id: targetFileId,
    kind,
    note: options.note ?? null,
    created_by: options.createdBy ?? "user",
  };

  if (options.anchor) {
    // Content-authored bridge: dedupe on the (source, target, anchor) key.
    const { error } = await sb
      .from("bridges")
      .upsert(
        { ...row, anchor: options.anchor },
        { onConflict: "source_file_id,target_file_id,anchor" }
      );
    if (error) throw new Error(`addBridge: ${error.message}`);
  } else {
    // Anchorless (e.g. AI) bridge: NULL anchors aren't deduped by the unique
    // constraint, so guard against duplicates explicitly.
    const { data: existing } = await sb
      .from("bridges")
      .select("id")
      .eq("source_file_id", sourceFileId)
      .eq("target_file_id", targetFileId)
      .is("anchor", null)
      .maybeSingle();
    if (!existing) {
      const { error } = await sb.from("bridges").insert({ ...row, anchor: null });
      if (error) throw new Error(`addBridge: ${error.message}`);
    }
  }
  revalidatePath("/files");
}

/** Remove a bridge by id. */
export async function removeBridge(bridgeId: string): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("bridges").delete().eq("id", bridgeId);
  if (error) throw new Error(`removeBridge: ${error.message}`);
  revalidatePath("/files");
}

interface ParsedCite {
  targetFileId: string;
  kind: BridgeKind;
  anchor: string;
  note: string | null;
}

/**
 * Pull every @-mention / footnote citation out of a document's saved HTML.
 * Mentions render as elements carrying `data-bridge` (target file id),
 * `data-bridge-kind`, and a stable `data-bridge-anchor`.
 */
function parseCitations(html: string): ParsedCite[] {
  const byAnchor = new Map<string, ParsedCite>();
  const tagRe = /<[a-z][a-z0-9]*\b[^>]*\bdata-bridge=[^>]*>/gi;
  for (const match of html.matchAll(tagRe)) {
    const tag = match[0];
    const targetFileId = /data-bridge="([^"]+)"/i.exec(tag)?.[1];
    if (!targetFileId) continue;
    const kind = (/data-bridge-kind="([^"]+)"/i.exec(tag)?.[1] ?? "cite") as
      | BridgeKind
      | string;
    const anchor =
      /data-bridge-anchor="([^"]+)"/i.exec(tag)?.[1] ?? `${targetFileId}:${kind}`;
    const note = /data-bridge-note="([^"]*)"/i.exec(tag)?.[1] ?? null;
    byAnchor.set(anchor, {
      targetFileId,
      kind: kind === "footnote" ? "footnote" : "cite",
      anchor,
      note: note ? decodeURIComponent(note) : null,
    });
  }
  return [...byAnchor.values()];
}

/**
 * Reconcile a document's content-authored bridges with its saved body. Treats
 * the editor as the source of truth: bridges that carry an anchor (i.e. were
 * authored in the body) are made to exactly match the citations now present.
 * AI-added bridges (no anchor) are left untouched.
 */
export async function syncBridgesFromContent(
  sourceFileId: string,
  html: string
): Promise<void> {
  const cites = parseCitations(html).filter(
    (c) => c.targetFileId !== sourceFileId
  );
  const sb = await getSupabaseServer();

  // Existing content-authored bridges for this source.
  const { data: existing, error: exErr } = await sb
    .from("bridges")
    .select("id, anchor")
    .eq("source_file_id", sourceFileId)
    .not("anchor", "is", null);
  if (exErr) throw new Error(`syncBridgesFromContent (read): ${exErr.message}`);

  const wantAnchors = new Set(cites.map((c) => c.anchor));
  const stale = ((existing ?? []) as { id: string; anchor: string }[]).filter(
    (b) => !wantAnchors.has(b.anchor)
  );
  if (stale.length > 0) {
    const { error } = await sb
      .from("bridges")
      .delete()
      .in(
        "id",
        stale.map((b) => b.id)
      );
    if (error) throw new Error(`syncBridgesFromContent (delete): ${error.message}`);
  }

  if (cites.length > 0) {
    const rows = cites.map((c) => ({
      source_file_id: sourceFileId,
      target_file_id: c.targetFileId,
      kind: c.kind,
      anchor: c.anchor,
      note: c.note,
      created_by: "user" as GraphAuthor,
    }));
    const { error } = await sb
      .from("bridges")
      .upsert(rows, { onConflict: "source_file_id,target_file_id,anchor" });
    if (error) throw new Error(`syncBridgesFromContent (upsert): ${error.message}`);
  }
}
