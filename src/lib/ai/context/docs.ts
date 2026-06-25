/**
 * Server-side access to Archon's editable context documents (`agent_context_docs`).
 *
 * Six singleton docs compose Archon's system prompt and carry its self-improving
 * state: soul, app, harness, skills, memory, persona. Reads are resilient (fall
 * back to the in-code defaults so the chat route can never be taken down by a DB
 * hiccup). Writes go through `updateContextDoc`, which lets the DB triggers bump
 * the version and append to the revision log.
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  CONTEXT_DOC_TYPES,
  DEFAULT_CONTEXT_DOCS,
  NEVER_BLANK_DOCS,
  type ContextDocType,
} from "@/lib/ai/context/defaults";

export type { ContextDocType };

export type ContextDocAuthor = "user" | "agent" | "system";

export interface ContextDoc {
  docType: ContextDocType;
  content: string;
  version: number;
  updatedBy: ContextDocAuthor;
  updatedAt: string;
}

/** A map of every doc type to its current content, ready to assemble. */
export type ContextDocMap = Record<ContextDocType, string>;

interface ContextDocRow {
  doc_type: string;
  content: string | null;
}

/**
 * Load all six docs as a `{ type: content }` map. Missing or (for never-blank
 * docs) empty rows fall back to the seeded default. Resilient: any failure
 * returns the full default set rather than throwing.
 */
export async function loadContextDocs(): Promise<ContextDocMap> {
  const map: ContextDocMap = { ...DEFAULT_CONTEXT_DOCS };
  if (!hasSupabase()) return map;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("agent_context_docs")
      .select("doc_type, content");
    if (error) throw error;
    for (const row of (data ?? []) as ContextDocRow[]) {
      if (!CONTEXT_DOC_TYPES.includes(row.doc_type as ContextDocType)) continue;
      const type = row.doc_type as ContextDocType;
      const stored = row.content ?? "";
      map[type] =
        !stored.trim() && NEVER_BLANK_DOCS.includes(type)
          ? DEFAULT_CONTEXT_DOCS[type]
          : stored;
    }
    return map;
  } catch (err) {
    console.error("loadContextDocs failed", err);
    return map;
  }
}

/** All docs with metadata, for the settings editor (stored content as-is). */
export async function getAllContextDocs(): Promise<ContextDoc[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("agent_context_docs")
    .select("doc_type, content, version, updated_by, updated_at");
  if (error) throw new Error(`getAllContextDocs: ${error.message}`);
  return ((data ?? []) as {
    doc_type: string;
    content: string | null;
    version: number;
    updated_by: string;
    updated_at: string;
  }[]).map((d) => ({
    docType: d.doc_type as ContextDocType,
    content: d.content ?? "",
    version: d.version,
    updatedBy: d.updated_by as ContextDocAuthor,
    updatedAt: d.updated_at,
  }));
}

/** One doc with its metadata, for the settings editor. Null if not found. */
export async function getContextDoc(
  docType: ContextDocType
): Promise<ContextDoc | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("agent_context_docs")
    .select("doc_type, content, version, updated_by, updated_at")
    .eq("doc_type", docType)
    .maybeSingle();
  if (error) throw new Error(`getContextDoc: ${error.message}`);
  if (!data) return null;
  return {
    docType: data.doc_type as ContextDocType,
    content: data.content ?? "",
    version: data.version as number,
    updatedBy: data.updated_by as ContextDocAuthor,
    updatedAt: data.updated_at as string,
  };
}

/**
 * Update a doc's content. The DB bumps `version` and mirrors the new content
 * into `agent_context_revisions` (with `rationale`) automatically, so this is
 * the single write path that keeps the audit trail complete.
 */
export async function updateContextDoc(
  docType: ContextDocType,
  content: string,
  opts: { updatedBy: ContextDocAuthor; rationale?: string }
): Promise<void> {
  if (!hasSupabase()) return;
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("agent_context_docs")
    .update({
      content,
      updated_by: opts.updatedBy,
      last_edit_rationale: opts.rationale ?? null,
    })
    .eq("doc_type", docType);
  if (error) throw new Error(`updateContextDoc: ${error.message}`);
}
