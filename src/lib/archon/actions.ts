"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { regenerateSkillsMenu } from "@/lib/archon/skills-menu";
import { getToolCatalog, type ToolInfo } from "@/lib/ai/tool-catalog";
import type { SkillCategory } from "@/lib/archon/skills";

export interface CustomSkillInput {
  name: string;
  description: string;
  category: SkillCategory;
  examples: string[];
  /** Full markdown body: how and when to use the skill. */
  content: string;
  /** Tool allowlist chosen in the editor's tool picker (exact tool names). */
  toolNames: string[];
}

/**
 * Rebuild the derived Skills.md menu after a skill write. Scheduled with `after`
 * so the (possibly model-backed) regeneration runs in the background and never
 * blocks the settings action's response.
 */
function scheduleMenuRebuild(): void {
  after(() => regenerateSkillsMenu());
}

/** The full tool catalog for the skill editor's tool picker. */
export async function listToolCatalog(): Promise<ToolInfo[]> {
  await requireUser();
  return getToolCatalog();
}

/** Create a custom Archon skill; returns the new id. */
export async function createCustomSkill(
  input: CustomSkillInput
): Promise<{ id: string }> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("archon_skills")
    .insert({
      name: input.name,
      description: input.description || null,
      category: input.category,
      examples: input.examples.length ? input.examples : null,
      content: input.content,
      tool_names: input.toolNames,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createCustomSkill: ${error.message}`);
  revalidatePath("/settings");
  scheduleMenuRebuild();
  return { id: data.id };
}

/** Update a custom skill's details. Built-in skills aren't stored here. */
export async function updateCustomSkill(
  id: string,
  input: CustomSkillInput
): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("archon_skills")
    .update({
      name: input.name,
      description: input.description || null,
      category: input.category,
      examples: input.examples.length ? input.examples : null,
      content: input.content,
      tool_names: input.toolNames,
    })
    .eq("id", id);
  if (error) throw new Error(`updateCustomSkill: ${error.message}`);
  revalidatePath("/settings");
  scheduleMenuRebuild();
}

/** Enable or disable a custom skill. */
export async function setSkillEnabled(
  id: string,
  enabled: boolean
): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("archon_skills")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(`setSkillEnabled: ${error.message}`);
  revalidatePath("/settings");
  scheduleMenuRebuild();
}

/** Permanently remove a custom skill. */
export async function deleteCustomSkill(id: string): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb.from("archon_skills").delete().eq("id", id);
  if (error) throw new Error(`deleteCustomSkill: ${error.message}`);
  revalidatePath("/settings");
  scheduleMenuRebuild();
}
