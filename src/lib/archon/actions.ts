"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/permissions";
import type { SkillCategory } from "@/lib/archon/skills";

export interface CustomSkillInput {
  name: string;
  description: string;
  category: SkillCategory;
  examples: string[];
}

/** Create a custom Archon skill; returns the new id. */
export async function createCustomSkill(
  input: CustomSkillInput
): Promise<{ id: string }> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("archon_skills")
    .insert({
      name: input.name,
      description: input.description || null,
      category: input.category,
      examples: input.examples.length ? input.examples : null,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createCustomSkill: ${error.message}`);
  revalidatePath("/settings");
  return { id: data.id };
}

/** Update a custom skill's details. Built-in skills aren't stored here. */
export async function updateCustomSkill(
  id: string,
  input: CustomSkillInput
): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("archon_skills")
    .update({
      name: input.name,
      description: input.description || null,
      category: input.category,
      examples: input.examples.length ? input.examples : null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateCustomSkill: ${error.message}`);
  revalidatePath("/settings");
}

/** Enable or disable a custom skill. */
export async function setSkillEnabled(
  id: string,
  enabled: boolean
): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("archon_skills")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(`setSkillEnabled: ${error.message}`);
  revalidatePath("/settings");
}

/** Permanently remove a custom skill. */
export async function deleteCustomSkill(id: string): Promise<void> {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { error } = await sb.from("archon_skills").delete().eq("id", id);
  if (error) throw new Error(`deleteCustomSkill: ${error.message}`);
  revalidatePath("/settings");
}
