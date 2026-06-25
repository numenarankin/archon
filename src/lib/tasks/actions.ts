"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Task, TaskStatus } from "@/lib/tasks/tasks";

export type TaskInput = Omit<Task, "id">;

function toRow(input: TaskInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    priority: input.priority,
    assignee: input.assignee ?? null,
    deadline: input.deadline ?? null,
    // A time is only meaningful alongside a date.
    deadline_time: input.deadline ? input.deadlineTime ?? null : null,
    folder_id: input.folderId ?? null,
    budget: input.budget ?? null,
    spend: input.spend ?? null,
    blocked_by: input.blockedBy ?? [],
  };
}

/** Revalidate the global board plus, when tagged, the owning project page. */
function revalidateTask(folderId?: string): void {
  revalidatePath("/tasks");
  if (folderId) revalidatePath("/projects", "layout");
}

/**
 * Replace a task's linked documents with the given set. Clears the existing
 * `task_files` links and reinserts, so the task's documents always match what
 * the modal submitted.
 */
async function setTaskDocuments(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>,
  taskId: string,
  documents: { id: string }[]
): Promise<void> {
  const cleared = await sb.from("task_files").delete().eq("task_id", taskId);
  if (cleared.error) {
    throw new Error(`setTaskDocuments (clear): ${cleared.error.message}`);
  }
  if (documents.length === 0) return;
  const rows = documents.map((d) => ({ task_id: taskId, file_id: d.id }));
  const inserted = await sb.from("task_files").insert(rows);
  if (inserted.error) {
    throw new Error(`setTaskDocuments (insert): ${inserted.error.message}`);
  }
}

/**
 * Create a task. New tasks get a large `sort_order` (the current epoch ms) so
 * they sort after everything already in their column and land at the bottom,
 * regardless of whether that column has been manually reordered yet.
 */
export async function createTask(input: TaskInput): Promise<void> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("tasks")
    .insert({ ...toRow(input), sort_order: Date.now() })
    .select("id")
    .single();
  if (error) throw new Error(`createTask: ${error.message}`);
  const newId = (data as { id: string } | null)?.id;
  if (newId) await setTaskDocuments(sb, newId, input.documents ?? []);
  revalidateTask(input.folderId);
}

/** Update a task's fields. */
export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("tasks").update(toRow(input)).eq("id", id);
  if (error) throw new Error(`updateTask: ${error.message}`);
  await setTaskDocuments(sb, id, input.documents ?? []);
  revalidateTask(input.folderId);
}

/** A task's drag-and-drop result: which column it's in and its row within it. */
export interface TaskOrder {
  id: string;
  status: TaskStatus;
  sortOrder: number;
}

/**
 * Persist the board order after a drag — both the column a task lives in
 * (`status`) and its position within that column (`sortOrder`). The client
 * sends the full, renormalized order (0, 1, 2, … per column), so one call
 * covers reordering within a column and moving a card between columns.
 */
export async function reorderTasks(
  items: TaskOrder[],
  folderId?: string
): Promise<void> {
  if (items.length === 0) return;
  const sb = await getSupabaseServer();
  const results = await Promise.all(
    items.map((it) =>
      sb
        .from("tasks")
        .update({ status: it.status, sort_order: it.sortOrder })
        .eq("id", it.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`reorderTasks: ${failed.error.message}`);
  revalidateTask(folderId);
}
