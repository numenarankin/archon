import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  Bridge,
  BridgeKind,
  GraphAuthor,
  GraphData,
  GraphEdge,
  GraphNode,
  KBFileType,
  MentionCandidate,
  Tag,
} from "@/lib/kb/types";

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };

/** Normalized key for a tag so "@royalties" and "Royalties" resolve to one row. */
export function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface BridgeRow {
  id: string;
  source_file_id: string;
  target_file_id: string;
  kind: string;
  anchor: string | null;
  note: string | null;
  created_by: string;
}

function toBridge(row: BridgeRow): Bridge {
  return {
    id: row.id,
    sourceFileId: row.source_file_id,
    targetFileId: row.target_file_id,
    kind: row.kind as BridgeKind,
    anchor: row.anchor,
    note: row.note,
    createdBy: row.created_by as GraphAuthor,
  };
}

interface TagRow {
  id: string;
  name: string;
  slug: string;
}

function toTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, slug: row.slug };
}

/** Bridges where the given file is the citing (source) document. */
export async function getOutgoingBridges(fileId: string): Promise<Bridge[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("bridges")
    .select("id, source_file_id, target_file_id, kind, anchor, note, created_by")
    .eq("source_file_id", fileId);
  if (error) throw new Error(`getOutgoingBridges: ${error.message}`);
  return ((data ?? []) as BridgeRow[]).map(toBridge);
}

/** Bridges where the given file is the cited (target) document — its backlinks. */
export async function getIncomingBridges(fileId: string): Promise<Bridge[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("bridges")
    .select("id, source_file_id, target_file_id, kind, anchor, note, created_by")
    .eq("target_file_id", fileId);
  if (error) throw new Error(`getIncomingBridges: ${error.message}`);
  return ((data ?? []) as BridgeRow[]).map(toBridge);
}

/** Tags applied to one file. */
export async function getFileTags(fileId: string): Promise<Tag[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("file_tags")
    .select("tags ( id, name, slug )")
    .eq("file_id", fileId);
  if (error) throw new Error(`getFileTags: ${error.message}`);
  // PostgREST returns the to-one `tags` relation as a single object at runtime;
  // the typed client widens it to an array, so cast through unknown.
  return ((data ?? []) as unknown as { tags: TagRow | null }[])
    .map((r) => r.tags)
    .filter((t): t is TagRow => t != null)
    .map(toTag)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tags whose name begins with (or contains) a prefix — for the tag picker. */
export async function searchTags(prefix: string): Promise<Tag[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  let query = sb.from("tags").select("id, name, slug").order("name").limit(10);
  const trimmed = prefix.trim();
  if (trimmed) query = query.ilike("name", `%${trimmed}%`);
  const { data, error } = await query;
  if (error) throw new Error(`searchTags: ${error.message}`);
  return ((data ?? []) as TagRow[]).map(toTag);
}

/** File ids tagged with a given tag (by slug or id). */
export async function getFilesByTag(tagSlugOrId: string): Promise<string[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  // Resolve a slug to its id; accept a raw uuid too. Guard the id branch so a
  // non-uuid (the common case — the AI passes a tag name) never hits uuid.eq.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tagSlugOrId
    );
  const filter = isUuid
    ? `slug.eq.${tagSlug(tagSlugOrId)},id.eq.${tagSlugOrId}`
    : `slug.eq.${tagSlug(tagSlugOrId)}`;
  const { data: tag } = await sb.from("tags").select("id").or(filter).maybeSingle();
  if (!tag) return [];
  const { data, error } = await sb
    .from("file_tags")
    .select("file_id")
    .eq("tag_id", tag.id);
  if (error) throw new Error(`getFilesByTag: ${error.message}`);
  return ((data ?? []) as { file_id: string }[]).map((r) => r.file_id);
}

/** File ids placed directly in a folder; null folderId = whole corpus. */
async function scopedFileIds(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>,
  folderId?: string | null
): Promise<string[] | null> {
  if (!folderId || folderId === "root") return null;
  const { data, error } = await sb
    .from("file_placements")
    .select("file_id")
    .eq("folder_id", folderId);
  if (error) throw new Error(`scopedFileIds: ${error.message}`);
  return [...new Set(((data ?? []) as { file_id: string }[]).map((r) => r.file_id))];
}

/**
 * The bridge/tag graph for a folder (or the whole corpus when no folder is
 * given). Nodes are files (with their tags); edges are bridges between two files
 * that are both in scope.
 */
export async function getGraph(folderId?: string | null): Promise<GraphData> {
  if (!hasSupabase()) return EMPTY_GRAPH;
  const sb = await getSupabaseServer();

  const ids = await scopedFileIds(sb, folderId);
  if (ids && ids.length === 0) return EMPTY_GRAPH;

  // Files in scope.
  let filesQuery = sb.from("files").select("id, name, type");
  if (ids) filesQuery = filesQuery.in("id", ids);
  const { data: files, error: filesErr } = await filesQuery;
  if (filesErr) throw new Error(`getGraph (files): ${filesErr.message}`);
  const fileRows = (files ?? []) as { id: string; name: string; type: string }[];
  const inScope = new Set(fileRows.map((f) => f.id));
  if (inScope.size === 0) return EMPTY_GRAPH;
  const scopeIds = [...inScope];

  // Tags for those files.
  const { data: fileTags, error: ftErr } = await sb
    .from("file_tags")
    .select("file_id, tags ( id, name, slug )")
    .in("file_id", scopeIds);
  if (ftErr) throw new Error(`getGraph (file_tags): ${ftErr.message}`);
  const tagsByFile = new Map<string, Tag[]>();
  for (const row of (fileTags ?? []) as unknown as {
    file_id: string;
    tags: TagRow | null;
  }[]) {
    if (!row.tags) continue;
    const list = tagsByFile.get(row.file_id) ?? [];
    list.push(toTag(row.tags));
    tagsByFile.set(row.file_id, list);
  }

  const nodes: GraphNode[] = fileRows.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type as KBFileType,
    tags: tagsByFile.get(f.id) ?? [],
  }));

  // Bridges where the source is in scope; keep only edges whose target is also
  // in scope so the graph stays self-contained for the folder.
  const { data: bridges, error: bErr } = await sb
    .from("bridges")
    .select("id, source_file_id, target_file_id, kind, created_by")
    .in("source_file_id", scopeIds);
  if (bErr) throw new Error(`getGraph (bridges): ${bErr.message}`);
  const edges: GraphEdge[] = ((bridges ?? []) as BridgeRow[])
    .filter((b) => inScope.has(b.target_file_id))
    .map((b) => ({
      id: b.id,
      source: b.source_file_id,
      target: b.target_file_id,
      kind: b.kind as BridgeKind,
      createdBy: b.created_by as GraphAuthor,
    }));

  return { nodes, edges };
}

/** Files carrying a tag, with names — for the AI's search_by_tag tool. */
export async function getTaggedFiles(
  tagSlugOrId: string
): Promise<MentionCandidate[]> {
  if (!hasSupabase()) return [];
  const ids = await getFilesByTag(tagSlugOrId);
  if (ids.length === 0) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("files")
    .select("id, name, type")
    .in("id", ids)
    .order("name");
  if (error) throw new Error(`getTaggedFiles: ${error.message}`);
  return ((data ?? []) as { id: string; name: string; type: string }[]).map(
    (f) => ({ id: f.id, name: f.name, type: f.type as KBFileType })
  );
}

/**
 * A file's outgoing bridges with target names and bridge ids — for editor UIs
 * that list and remove a document's citations (e.g. the diagram canvas).
 */
export async function getOutgoingCitations(
  fileId: string
): Promise<{ id: string; targetFileId: string; name: string; kind: BridgeKind }[]> {
  const bridges = await getOutgoingBridges(fileId);
  if (bridges.length === 0) return [];
  const sb = await getSupabaseServer();
  const ids = [...new Set(bridges.map((b) => b.targetFileId))];
  const { data } = await sb.from("files").select("id, name").in("id", ids);
  const nameById = new Map(
    ((data ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name])
  );
  return bridges.map((b) => ({
    id: b.id,
    targetFileId: b.targetFileId,
    name: nameById.get(b.targetFileId) ?? "unknown",
    kind: b.kind,
  }));
}

/**
 * A file's bridges with the names of the documents on each end — for the AI's
 * get_bridges tool. `cites` are docs this file points at; `citedBy` are docs
 * that point back at it (backlinks).
 */
export async function getFileConnections(fileId: string): Promise<{
  cites: { fileId: string; name: string; kind: BridgeKind }[];
  citedBy: { fileId: string; name: string; kind: BridgeKind }[];
  tags: Tag[];
}> {
  const [outgoing, incoming, tags] = await Promise.all([
    getOutgoingBridges(fileId),
    getIncomingBridges(fileId),
    getFileTags(fileId),
  ]);
  if (!hasSupabase()) return { cites: [], citedBy: [], tags: [] };
  const sb = await getSupabaseServer();
  const ids = [
    ...new Set([
      ...outgoing.map((b) => b.targetFileId),
      ...incoming.map((b) => b.sourceFileId),
    ]),
  ];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await sb.from("files").select("id, name").in("id", ids);
    for (const f of (data ?? []) as { id: string; name: string }[]) {
      nameById.set(f.id, f.name);
    }
  }
  return {
    cites: outgoing.map((b) => ({
      fileId: b.targetFileId,
      name: nameById.get(b.targetFileId) ?? "unknown",
      kind: b.kind,
    })),
    citedBy: incoming.map((b) => ({
      fileId: b.sourceFileId,
      name: nameById.get(b.sourceFileId) ?? "unknown",
      kind: b.kind,
    })),
    tags,
  };
}

/**
 * Files matching a name query, for the editor's @-mention picker. Scoped to a
 * folder when given so a project's docs surface first. Excludes the doc the user
 * is editing (no self-citations).
 */
export async function searchFilesForMention(
  query: string,
  folderId?: string | null,
  excludeFileId?: string
): Promise<MentionCandidate[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();

  const ids = await scopedFileIds(sb, folderId);
  if (ids && ids.length === 0) return [];

  let q = sb.from("files").select("id, name, type").order("name").limit(8);
  if (ids) q = q.in("id", ids);
  const trimmed = query.trim();
  if (trimmed) q = q.ilike("name", `%${trimmed}%`);
  const { data, error } = await q;
  if (error) throw new Error(`searchFilesForMention: ${error.message}`);

  return ((data ?? []) as { id: string; name: string; type: string }[])
    .filter((f) => f.id !== excludeFileId)
    .map((f) => ({ id: f.id, name: f.name, type: f.type as KBFileType }));
}
