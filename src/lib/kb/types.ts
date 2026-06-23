/**
 * Knowledge-base types shared by the file tree and editor.
 *
 * Prototype scope: these describe the shape the UI renders against. The real
 * data source (Supabase / GitHub) gets wired up later.
 */

export type KBFileType =
  | "pdf"
  | "doc"
  | "md"
  | "transcript"
  | "note"
  | "url"
  | "image"
  | "las"
  | "diagram";

export interface KBFile {
  id: string;
  name: string;
  /** Full path within the folder, e.g. "geology/structure-map.md". */
  path: string;
  type: KBFileType;
  /** Owning folder id; "" means the repo root. */
  folder_id: string;
}

export interface KBFolder {
  id: string;
  name: string;
}

export interface KBTreeNode {
  folder: KBFolder;
  subfolders: KBTreeNode[];
  files: KBFile[];
}

/** A file in the company knowledge base, available to add to a project. */
export interface RepoFile extends KBFile {
  size: string;
  modified: string;
  /** Pinned within its current folder (floats to the top). */
  pinned?: boolean;
}

/** A folder in the company knowledge base — may hold subfolders and files. */
export interface RepoFolder {
  id: string;
  name: string;
  folders: RepoFolder[];
  files: RepoFile[];
  modified: string;
}

// ── Knowledge graph ──────────────────────────────────────────────────────────

/** Who created a graph connection — a person, or the AI on explicit request. */
export type GraphAuthor = "user" | "ai";

/** How a citation was made: inline @-mention, or a footnote reference. */
export type BridgeKind = "cite" | "footnote";

/** A directed citation from one document to another. */
export interface Bridge {
  id: string;
  sourceFileId: string;
  targetFileId: string;
  kind: BridgeKind;
  anchor: string | null;
  note: string | null;
  createdBy: GraphAuthor;
}

/** A topic area applied to files. */
export interface Tag {
  id: string;
  name: string;
  slug: string;
}

/** A file decorated with its tags, for graph rendering. */
export interface GraphNode {
  id: string;
  name: string;
  type: KBFileType;
  tags: Tag[];
}

/** A bridge edge between two graph nodes. */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: BridgeKind;
  createdBy: GraphAuthor;
}

/** The bridge/tag graph for a folder (or the whole corpus). */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** A file match surfaced by the @-mention picker. */
export interface MentionCandidate {
  id: string;
  name: string;
  type: KBFileType;
}
