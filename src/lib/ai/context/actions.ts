"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  updateContextDoc,
  type ContextDocAuthor,
  type ContextDocType,
} from "@/lib/ai/context/docs";

/** A single past version of a context doc, for the revision timeline. */
export interface ContextRevision {
  id: string;
  version: number;
  updatedBy: ContextDocAuthor;
  rationale: string | null;
  createdAt: string;
  content: string;
}

/** Save a user edit to a context doc. The DB versions it and logs the revision. */
export async function saveContextDoc(
  docType: ContextDocType,
  content: string
): Promise<void> {
  await requireAdmin();
  await updateContextDoc(docType, content, { updatedBy: "user" });
  revalidatePath("/settings");
}

/** The revision history for a doc, newest first. */
export async function listContextRevisions(
  docType: ContextDocType
): Promise<ContextRevision[]> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("agent_context_revisions")
    .select("id, version, updated_by, rationale, created_at, content")
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(50);
  if (error) throw new Error(`listContextRevisions: ${error.message}`);
  return ((data ?? []) as {
    id: string;
    version: number;
    updated_by: string;
    rationale: string | null;
    created_at: string;
    content: string;
  }[]).map((r) => ({
    id: r.id,
    version: r.version,
    updatedBy: r.updated_by as ContextDocAuthor,
    rationale: r.rationale,
    createdAt: r.created_at,
    content: r.content,
  }));
}

/** Restore a doc to an earlier revision's content (recorded as a new version). */
export async function rollbackContextDoc(
  docType: ContextDocType,
  content: string,
  toVersion: number
): Promise<void> {
  await requireAdmin();
  await updateContextDoc(docType, content, {
    updatedBy: "user",
    rationale: `Rolled back to version ${toVersion}`,
  });
  revalidatePath("/settings");
}
