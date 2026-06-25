"use server";

import { revalidatePath } from "next/cache";
import { marked } from "marked";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { embedFile } from "@/lib/ai/retrieval";
import { syncBridgesFromContent } from "@/lib/files/graph-actions";
import type { KBFileType } from "@/lib/kb/types";

const BUCKET = "files";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"];

/** Map a filename's extension to one of the allowed file types. */
function fileType(name: string): KBFileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "txt" || ext === "rtf" || ext === "doc" || ext === "docx")
    return "doc";
  return "doc";
}

function randomId(): string {
  return crypto.randomUUID();
}

/**
 * The Files UI uses a synthetic "root" node; the database represents root as a
 * null folder / parent. Translate the sentinel before writing.
 */
function resolveFolderId(id: string): string | null {
  return id === "root" ? null : id;
}

/**
 * Upload one or more files into a folder: bytes → Storage bucket (keyed by file
 * id), metadata → `files`, membership → `file_placements`.
 */
export async function uploadFiles(
  folderId: string,
  formData: FormData
): Promise<void> {
  const sb = await getSupabaseServer();
  // The workspace that will own these files; used to namespace the storage key
  // (`<workspace_id>/<id>`) so the bucket's prefix-scoped RLS lines up with the
  // workspace_id the DB row defaults to.
  const { data: workspaceId } = await sb.rpc("app_default_workspace_id");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  for (const file of files) {
    const id = randomId();
    const storageKey = workspaceId ? `${workspaceId}/${id}` : id;
    const bytes = await file.arrayBuffer();

    // Bytes go to the private bucket via the admin client; the DB rows below go
    // through the request-scoped client so RLS assigns workspace_id and enforces
    // access.
    const { error: upErr } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .upload(storageKey, bytes, { contentType: file.type || undefined, upsert: false });
    if (upErr) throw new Error(`uploadFiles (storage): ${upErr.message}`);

    // Extract text inline for text-like docs (incl. structured LAS/CSV/TSV) so
    // Archon can search + analyse them right away. Binaries (PDF, images) need
    // OCR → handled separately inside embedFile.
    const isText = /\.(md|markdown|txt|csv|tsv|json|las)$/i.test(file.name);
    const content = isText ? new TextDecoder().decode(bytes) : null;

    const { error: fileErr } = await sb.from("files").insert({
      id,
      name: file.name,
      type: fileType(file.name),
      mime: file.type || null,
      size: file.size,
      storage_key: storageKey,
      content,
    });
    if (fileErr) throw new Error(`uploadFiles (files): ${fileErr.message}`);

    const { error: placeErr } = await sb
      .from("file_placements")
      .insert({ file_id: id, folder_id: resolveFolderId(folderId) });
    if (placeErr) throw new Error(`uploadFiles (placement): ${placeErr.message}`);

    // Index EVERY uploaded file so it's searchable: text inline now, PDFs/images
    // via OCR inside embedFile.
    try {
      await embedFile(id);
    } catch (error) {
      console.error("embedFile failed", error);
    }
  }

  revalidatePath("/files");
}

/** Create a subfolder. */
export async function createFolder(
  parentId: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("folders")
    .insert({
      name: trimmed,
      parent_folder_id: resolveFolderId(parentId),
      is_system: false,
    });
  if (error) throw new Error(`createFolder: ${error.message}`);
  revalidatePath("/files");
}

/** Create an empty markdown document in a folder; returns its id. */
export async function createDoc(
  folderId: string,
  name = "Untitled.md"
): Promise<{ id: string }> {
  const sb = await getSupabaseServer();
  const id = randomId();
  const { error: fileErr } = await sb
    .from("files")
    .insert({ id, name, type: "md", content: "" });
  if (fileErr) throw new Error(`createDoc (files): ${fileErr.message}`);
  const { error: placeErr } = await sb
    .from("file_placements")
    .insert({ file_id: id, folder_id: resolveFolderId(folderId) });
  if (placeErr) throw new Error(`createDoc (placement): ${placeErr.message}`);
  revalidatePath("/files");
  return { id };
}

/**
 * Create a markdown document authored by Archon in a folder. The agent supplies
 * Markdown; we convert it to the HTML the editor stores so it renders correctly,
 * then index it for search. Returns the new file's id + name.
 */
export async function createProjectDocument(
  folderId: string,
  name: string,
  markdown: string
): Promise<{ id: string; name: string }> {
  const sb = await getSupabaseServer();
  const id = randomId();
  const trimmed = name.trim() || "Untitled";
  const fileName = /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
  const html = (await marked.parse(markdown ?? "")).toString();

  const { error: fileErr } = await sb
    .from("files")
    .insert({ id, name: fileName, type: "md", content: html });
  if (fileErr) throw new Error(`createProjectDocument (files): ${fileErr.message}`);

  const { error: placeErr } = await sb
    .from("file_placements")
    .insert({ file_id: id, folder_id: resolveFolderId(folderId) });
  if (placeErr)
    throw new Error(`createProjectDocument (placement): ${placeErr.message}`);

  // Index it so it's immediately searchable (and feeds the project's RAG).
  try {
    await embedFile(id);
  } catch (error) {
    console.error("embedFile (createProjectDocument) failed", error);
  }

  // Revalidate the files surface; the project tree refreshes client-side
  // (the project page is keyed by project slug, not this folder id).
  revalidatePath("/files");
  return { id, name: fileName };
}

/** Load a document's editable body + metadata. */
export async function getDoc(
  fileId: string
): Promise<{ id: string; name: string; type: string; content: string } | null> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("files")
    .select("id, name, type, content")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw new Error(`getDoc: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    content: data.content ?? "",
  };
}

/** Save a document's inline body and re-index it for search. */
export async function saveDoc(fileId: string, content: string): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("files")
    .update({ content })
    .eq("id", fileId);
  if (error) throw new Error(`saveDoc: ${error.message}`);

  // Reconcile the document's @-mention / footnote citations ("bridges") with its
  // saved body — the editor is the source of truth for content-authored links.
  try {
    await syncBridgesFromContent(fileId, content);
  } catch (error) {
    console.error("syncBridgesFromContent (saveDoc) failed", error);
  }

  // Keep the search index in sync so Archon can find authored/edited docs.
  try {
    await embedFile(fileId);
  } catch (error) {
    console.error("embedFile (saveDoc) failed", error);
  }
}

/**
 * Edit an existing document's body (and optionally rename it). Archon supplies
 * Markdown — the same format as create — which we convert to the editor's HTML
 * and persist through `saveDoc`, so the body, its @-mention citations
 * (bridges), and the search index all stay in sync, exactly as a human edit in
 * the editor would. Only native text documents (inline `content`, no stored
 * binary) can be edited this way; uploaded PDFs/images are rejected.
 */
export async function editProjectDocument(
  fileId: string,
  markdown: string,
  name?: string
): Promise<
  { ok: true; id: string; name: string } | { ok: false; error: string }
> {
  const sb = await getSupabaseServer();
  const { data: file } = await sb
    .from("files")
    .select("id, name, type, storage_key")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false, error: "No document with that id." };
  if (file.storage_key) {
    return {
      ok: false,
      error:
        "That file is an uploaded/binary file (PDF, image, etc.), not an editable text document.",
    };
  }

  // Optional rename, mirroring createProjectDocument's `.md` default.
  let finalName = file.name as string;
  const trimmed = name?.trim();
  if (trimmed) {
    finalName = /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
    const { error: nameErr } = await sb
      .from("files")
      .update({ name: finalName })
      .eq("id", fileId);
    if (nameErr) {
      throw new Error(`editProjectDocument (rename): ${nameErr.message}`);
    }
  }

  // Body + bridges + reindex go through the canonical save path.
  const html = (await marked.parse(markdown ?? "")).toString();
  await saveDoc(fileId, html);

  revalidatePath("/files");
  return { ok: true, id: fileId, name: finalName };
}

/** Rename a folder (e.g. a project). */
export async function renameFolder(
  folderId: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("folders")
    .update({ name: trimmed })
    .eq("id", folderId);
  if (error) throw new Error(`renameFolder: ${error.message}`);
  revalidatePath("/projects");
  revalidatePath("/files");
}

/** Rename a file. */
export async function renameFile(fileId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("files")
    .update({ name: trimmed })
    .eq("id", fileId);
  if (error) throw new Error(`renameFile: ${error.message}`);
  revalidatePath("/files");
}

/** Pin / unpin a file within a specific folder (per-placement). */
export async function setPin(
  fileId: string,
  folderId: string,
  pinned: boolean
): Promise<void> {
  const sb = await getSupabaseServer();
  const resolved = resolveFolderId(folderId);
  const query = sb
    .from("file_placements")
    .update({ pinned })
    .eq("file_id", fileId);
  const { error } = await (resolved === null
    ? query.is("folder_id", null)
    : query.eq("folder_id", resolved));
  if (error) throw new Error(`setPin: ${error.message}`);
  revalidatePath("/files");
}

/**
 * Move a file from one folder to another (re-points its placement). Handles the
 * root sentinel and the case where the file is already placed in the target.
 */
export async function moveFile(
  fileId: string,
  fromFolderId: string,
  toFolderId: string
): Promise<void> {
  const from = resolveFolderId(fromFolderId);
  const to = resolveFolderId(toFolderId);
  if (from === to) return;
  const sb = await getSupabaseServer();

  // Already placed in the target? Then just drop the source placement.
  let existsQuery = sb
    .from("file_placements")
    .select("id")
    .eq("file_id", fileId);
  existsQuery =
    to === null
      ? existsQuery.is("folder_id", null)
      : existsQuery.eq("folder_id", to);
  const { data: existingTarget } = await existsQuery.maybeSingle();

  let delQuery = sb.from("file_placements").delete().eq("file_id", fileId);
  delQuery =
    from === null
      ? delQuery.is("folder_id", null)
      : delQuery.eq("folder_id", from);
  const { error: delErr } = await delQuery;
  if (delErr) throw new Error(`moveFile (remove): ${delErr.message}`);

  if (!existingTarget) {
    const { error: insErr } = await sb
      .from("file_placements")
      .insert({ file_id: fileId, folder_id: to });
    if (insErr) throw new Error(`moveFile (insert): ${insErr.message}`);
  }

  revalidatePath("/files");
}

/** Add existing files (by id) to a folder as new placements (skips duplicates). */
export async function addFilesToFolder(
  folderId: string,
  fileIds: string[]
): Promise<void> {
  if (fileIds.length === 0) return;
  const sb = await getSupabaseServer();
  const folder = resolveFolderId(folderId);

  for (const fileId of fileIds) {
    let existsQuery = sb
      .from("file_placements")
      .select("id")
      .eq("file_id", fileId);
    existsQuery =
      folder === null
        ? existsQuery.is("folder_id", null)
        : existsQuery.eq("folder_id", folder);
    const { data: exists } = await existsQuery.maybeSingle();
    if (!exists) {
      const { error } = await sb
        .from("file_placements")
        .insert({ file_id: fileId, folder_id: folder });
      if (error) throw new Error(`addFilesToFolder: ${error.message}`);
    }
  }

  revalidatePath(`/projects/${folderId}`);
}

/** Get a short-lived signed download URL, or null for inline-only docs. */
export async function getDownloadUrl(fileId: string): Promise<string | null> {
  const sb = await getSupabaseServer();
  const { data: file } = await sb
    .from("files")
    .select("storage_key")
    .eq("id", fileId)
    .maybeSingle();
  if (!file?.storage_key) return null;
  // The `files` read above passed RLS (the caller can access this file), so we
  // can mint the signed URL with the admin client against the private bucket.
  // One hour: long enough for the in-app PDF viewer, which lazily range-fetches
  // pages while the user reads/scrolls — a 60s link expires mid-session (400).
  const { data, error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(file.storage_key, 60 * 60);
  if (error) throw new Error(`getDownloadUrl: ${error.message}`);
  return data?.signedUrl ?? null;
}
