/**
 * Read-only diagram access for Archon's `read_diagram` tool. Returns the cached
 * semantic graph plus its text description — never the raw tldraw snapshot,
 * which is noise to the model. Kept out of "use server" actions so it can be
 * imported directly into the tool catalog.
 */
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { DiagramGraph } from "@/lib/diagrams/types";

export interface DiagramReadResult {
  name: string;
  graph: DiagramGraph | null;
  description: string | null;
}

export async function getDiagramSummary(
  fileId: string
): Promise<DiagramReadResult | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("files")
    .select("name, type, structured_summary, derived_content")
    .eq("id", fileId)
    .maybeSingle();
  if (!data || data.type !== "diagram") return null;
  return {
    name: data.name,
    graph: (data.structured_summary as DiagramGraph | null) ?? null,
    description: data.derived_content ?? null,
  };
}
