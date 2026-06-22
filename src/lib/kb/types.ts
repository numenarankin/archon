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
  | "las";

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
