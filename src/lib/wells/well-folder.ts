import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-well file storage reuses the unified file model: a subfolder under the
 * `Wells` system root holds each well's files (as ordinary `files` linked by
 * `file_placements`), exactly like projects sit under `Projects`.
 *
 * The subfolder is named by the well **id** (its immutable slug) rather than the
 * display name, so the link survives well renames and never collides — a stable
 * key without needing a dedicated column or join table.
 */

/** Find the `Wells` system root folder id, or null if it hasn't been seeded. */
async function findWellsRootId(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb
    .from("folders")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Wells")
    .is("parent_folder_id", null)
    .maybeSingle();
  if (error) throw new Error(`findWellsRootId: ${error.message}`);
  return data?.id ?? null;
}

/** Resolve the folder that holds a well's files, or null if not created yet. */
export async function findWellFolderId(
  sb: SupabaseClient,
  wellId: string
): Promise<string | null> {
  const rootId = await findWellsRootId(sb);
  if (!rootId) return null;
  const { data, error } = await sb
    .from("folders")
    .select("id")
    .eq("parent_folder_id", rootId)
    .eq("name", wellId)
    .maybeSingle();
  if (error) throw new Error(`findWellFolderId: ${error.message}`);
  return data?.id ?? null;
}

/** Resolve the well's folder, creating it under the `Wells` root on first use. */
export async function getOrCreateWellFolderId(
  sb: SupabaseClient,
  wellId: string
): Promise<string> {
  const existing = await findWellFolderId(sb, wellId);
  if (existing) return existing;

  const rootId = await findWellsRootId(sb);
  if (!rootId) {
    throw new Error(
      "getOrCreateWellFolderId: `Wells` system folder is missing (run the default_folders migration)"
    );
  }
  const { data, error } = await sb
    .from("folders")
    .insert({ name: wellId, parent_folder_id: rootId, is_system: false })
    .select("id")
    .single();
  if (error) throw new Error(`getOrCreateWellFolderId: ${error.message}`);
  return data.id;
}
