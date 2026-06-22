/**
 * Server-side access to the user-created Archon skills stored in Supabase
 * (`archon_skills`). The built-in catalog lives in `./skills`; these are the
 * custom skills the team defines on the Skills page. Mapped into the same
 * `ArchonSkill` shape so the UI and the prompt builder treat both uniformly.
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ArchonSkill, SkillCategory } from "@/lib/archon/skills";

interface ArchonSkillRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  examples: string[] | null;
  enabled: boolean;
}

function mapSkill(r: ArchonSkillRow): ArchonSkill {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    category: r.category as SkillCategory,
    icon: "sparkles",
    tools: ["custom"],
    examples: r.examples ?? [],
    // For stored skills, this carries the live enabled state (used to seed the
    // UI toggle and to decide what goes into the prompt).
    enabledByDefault: r.enabled,
    builtIn: false,
  };
}

/**
 * Returns the team's custom skills, newest first. Resilient by design: a query
 * failure (e.g. before the migration is applied) returns an empty list rather
 * than throwing, so it can't take down the chat route or the Skills page.
 */
export async function getCustomSkills(): Promise<ArchonSkill[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("archon_skills")
      .select("id, name, description, category, examples, enabled")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ArchonSkillRow[]).map(mapSkill);
  } catch (error) {
    console.error("getCustomSkills failed", error);
    return [];
  }
}
