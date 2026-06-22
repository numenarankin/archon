import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export interface ProjectFolder {
  /** Stable identifier / URL slug for the folder. */
  id: string;
  /** Display name shown beneath the folder icon. */
  name: string;
  /** Number of items inside the folder, when known. */
  itemCount?: number;
}

/**
 * Returns the project folders to display in the grid.
 *
 * Each project is a folder under the `Projects` system root.
 * Item counts are derived from `file_placements`.
 */
export async function getProjectFolders(): Promise<ProjectFolder[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();

  const { data: root, error: rootErr } = await sb
    .from("folders")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Projects")
    .maybeSingle();
  if (rootErr) throw new Error(`getProjectFolders: ${rootErr.message}`);
  if (!root) return [];

  const { data: children, error } = await sb
    .from("folders")
    .select("id, name")
    .eq("parent_folder_id", root.id)
    .order("name");
  if (error) throw new Error(`getProjectFolders: ${error.message}`);

  const folders: ProjectFolder[] = [];
  for (const f of children ?? []) {
    const { count } = await sb
      .from("file_placements")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", f.id);
    folders.push({ id: f.id, name: f.name, itemCount: count ?? 0 });
  }
  return folders;
}

/**
 * Resolve a project by the slug of its name (the pretty URL).
 * Returns the folder id + name, or null if no project matches.
 */
export async function getProjectBySlug(
  slug: string
): Promise<{ id: string; name: string } | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();

  const { data: root } = await sb
    .from("folders")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Projects")
    .maybeSingle();
  if (!root) return null;

  const { data: children } = await sb
    .from("folders")
    .select("id, name")
    .eq("parent_folder_id", root.id);

  const match = (children ?? []).find((f) => slugify(f.name) === slug);
  return match ? { id: match.id, name: match.name } : null;
}
