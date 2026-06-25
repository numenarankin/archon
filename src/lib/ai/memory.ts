import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { embedText } from "@/lib/ai/embeddings";

export interface MemoryMatch {
  id: string;
  content: string;
  score: number;
}

/**
 * Persist a durable fact/preference about how the user works.
 * `source` is "explicit" when the user asked to remember it, or "inferred" when
 * it was evicted from the in-context Memory.md during compaction (overflow).
 */
export async function rememberFact(
  content: string,
  source: "explicit" | "inferred" = "explicit"
): Promise<void> {
  if (!hasSupabase() || !content.trim()) return;
  const sb = await getSupabaseServer();
  const embedding = await embedText(content);
  const { error } = await sb
    .from("agent_memory")
    .insert({ content: content.trim(), embedding, source });
  if (error) throw new Error(`rememberFact: ${error.message}`);
}

/** Semantic recall of stored memories relevant to a query. */
export async function recallMemories(
  query: string,
  limit = 5
): Promise<MemoryMatch[]> {
  if (!hasSupabase() || !query.trim()) return [];
  const sb = await getSupabaseServer();
  const embedding = await embedText(query);
  const { data, error } = await sb.rpc("match_agent_memory", {
    query_embedding: embedding,
    match_count: limit,
  });
  if (error) throw new Error(`recallMemories: ${error.message}`);
  return (data ?? []) as MemoryMatch[];
}
