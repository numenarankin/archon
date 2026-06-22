import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { embedText } from "@/lib/ai/embeddings";

export interface MemoryMatch {
  id: string;
  content: string;
  score: number;
}

/** Persist a durable fact/preference about how the user works. */
export async function rememberFact(content: string): Promise<void> {
  if (!hasSupabase() || !content.trim()) return;
  const sb = await getSupabaseServer();
  const embedding = await embedText(content);
  const { error } = await sb
    .from("agent_memory")
    .insert({ content: content.trim(), embedding, source: "explicit" });
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
