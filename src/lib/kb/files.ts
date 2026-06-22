import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { RepoFile, RepoFolder } from "@/lib/kb/types";
import type { KBFile, KBFileType } from "@/lib/kb/types";

const EMPTY_ROOT: RepoFolder = {
  id: "root",
  name: "Files",
  modified: "",
  folders: [],
  files: [],
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const rounded = value < 10 && i > 0 ? value.toFixed(1) : String(Math.round(value));
  return `${rounded} ${units[i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

interface FolderRow {
  id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string | null;
}

interface FileRow {
  id: string;
  name: string;
  type: string;
  size: number | null;
  updated_at: string | null;
}

/**
 * Root folder of the file tree shown on the Files page, rebuilt from the
 * `folders` + `files` + `file_placements` tables. Empty until files exist.
 */
export async function getFilesRoot(): Promise<RepoFolder> {
  if (!hasSupabase()) return EMPTY_ROOT;
  const sb = await getSupabaseServer();

  const [foldersRes, filesRes, placementsRes] = await Promise.all([
    sb.from("folders").select("id, name, parent_folder_id, created_at"),
    sb.from("files").select("id, name, type, size, updated_at"),
    sb.from("file_placements").select("file_id, folder_id, pinned"),
  ]);
  if (foldersRes.error) throw new Error(`getFilesRoot: ${foldersRes.error.message}`);
  if (filesRes.error) throw new Error(`getFilesRoot: ${filesRes.error.message}`);
  if (placementsRes.error)
    throw new Error(`getFilesRoot: ${placementsRes.error.message}`);

  const folderRows = (foldersRes.data ?? []) as FolderRow[];
  const fileRows = (filesRes.data ?? []) as FileRow[];

  const root: RepoFolder = { ...EMPTY_ROOT, folders: [], files: [] };

  const nodes = new Map<string, RepoFolder>();
  for (const f of folderRows) {
    nodes.set(f.id, {
      id: f.id,
      name: f.name,
      modified: formatDate(f.created_at),
      folders: [],
      files: [],
    });
  }
  for (const f of folderRows) {
    const node = nodes.get(f.id);
    if (!node) continue;
    const parent = f.parent_folder_id ? nodes.get(f.parent_folder_id) : null;
    if (parent) parent.folders.push(node);
    else root.folders.push(node);
  }

  const filesById = new Map<string, FileRow>();
  for (const file of fileRows) filesById.set(file.id, file);

  for (const p of placementsRes.data ?? []) {
    const file = filesById.get(p.file_id);
    if (!file) continue;
    // A null folder_id means the file lives at the (synthetic) root.
    const folder = p.folder_id ? nodes.get(p.folder_id) : root;
    if (!folder) continue;
    const repoFile: RepoFile = {
      id: file.id,
      name: file.name,
      path: file.name,
      type: file.type as KBFileType,
      folder_id: p.folder_id ?? "root",
      size: formatSize(file.size),
      modified: formatDate(file.updated_at),
      pinned: p.pinned ?? false,
    };
    folder.files.push(repoFile);
  }

  const sortNode = (n: RepoFolder) => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name));
    n.files.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name)
    );
    n.folders.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

/** Depth-first lookup of a folder node by id within a built tree. */
function findFolderNode(node: RepoFolder, id: string): RepoFolder | null {
  if (node.id === id) return node;
  for (const child of node.folders) {
    const found = findFolderNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * The file tree rooted at one folder (e.g. a project), for the scoped file
 * browser. Returns the folder's subtree, or null if it no longer exists.
 */
export async function getFolderTree(
  folderId: string
): Promise<RepoFolder | null> {
  const root = await getFilesRoot();
  return findFolderNode(root, folderId);
}

/** Files placed directly in a given folder (a project). */
export async function getFolderFiles(folderId: string): Promise<KBFile[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();

  const { data: placements, error: pErr } = await sb
    .from("file_placements")
    .select("file_id")
    .eq("folder_id", folderId);
  if (pErr) throw new Error(`getFolderFiles: ${pErr.message}`);
  const ids = (placements ?? []).map((p) => p.file_id);
  if (ids.length === 0) return [];

  const { data: files, error: fErr } = await sb
    .from("files")
    .select("id, name, type")
    .in("id", ids)
    .order("name");
  if (fErr) throw new Error(`getFolderFiles: ${fErr.message}`);

  return (files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    path: f.name,
    type: f.type as KBFileType,
    folder_id: folderId,
  }));
}
