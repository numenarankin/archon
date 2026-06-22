"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Create a new project as a folder under the Projects root. */
export async function createProject(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const sb = await getSupabaseServer();

  const { data: root, error: rootErr } = await sb
    .from("folders")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Projects")
    .maybeSingle();
  if (rootErr) throw new Error(`createProject: ${rootErr.message}`);
  if (!root)
    throw new Error(
      "createProject: Projects root folder not found — run the default-folders migration"
    );

  const { error } = await sb.from("folders").insert({
    name: trimmed,
    parent_folder_id: root.id,
    is_system: false,
  });
  if (error) throw new Error(`createProject: ${error.message}`);

  revalidatePath("/projects");
}
