import { hasSupabase } from "@/lib/env";
import { getFilesRoot } from "@/lib/kb/files";
import { getTasks } from "@/lib/tasks/tasks";
import type { ArchonManifest } from "@/lib/ai/system-prompt";
import type { RepoFolder } from "@/lib/kb/types";

/** Flatten the folder tree into "Parent/Child" path strings. */
function folderPaths(folder: RepoFolder, prefix = ""): string[] {
  const paths: string[] = [];
  for (const child of folder.folders) {
    const path = prefix ? `${prefix}/${child.name}` : child.name;
    paths.push(path);
    paths.push(...folderPaths(child, path));
  }
  return paths;
}

/**
 * Build the small-universe manifest injected into Archon's system prompt so it
 * can resolve names → ids and know where things live without a lookup.
 */
export async function buildManifest(): Promise<ArchonManifest | undefined> {
  if (!hasSupabase()) return undefined;

  // NOTE: wells/inventory enrichment removed — those lib modules target the old
  // operator-app schema, which the live DB no longer has (the `wells` table is
  // now RRC public records keyed by api_number). Manifest is built only from
  // sources that exist in the current schema: files + tasks.
  const [root, tasks] = await Promise.all([getFilesRoot(), getTasks()]);

  const folders = folderPaths(root);

  return {
    folders,
    counts: {
      folders: folders.length,
      tasks: tasks.length,
    },
  };
}

let cache: { at: number; value: ArchonManifest | undefined } | null = null;

/**
 * Manifest with a short TTL cache. Used by latency-sensitive callers (the voice
 * loop) so we don't rebuild from the DB on every spoken turn. The typed chat
 * keeps using `buildManifest()` for always-fresh data.
 */
export async function buildManifestCached(
  ttlMs = 30_000
): Promise<ArchonManifest | undefined> {
  const now = Date.now();
  if (cache && now - cache.at < ttlMs) return cache.value;
  const value = await buildManifest();
  cache = { at: now, value };
  return value;
}
