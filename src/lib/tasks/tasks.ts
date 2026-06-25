import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

/** The kanban columns on the Tasks page, in board order. */
export type TaskStatus = "planned" | "priority" | "doing" | "done";

export type TaskPriority = "Low" | "Medium" | "High";

/** A single work item on the Tasks kanban board. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Person responsible, free-form (e.g. "J. Hale"). */
  assignee?: string;
  /** Due date as an ISO `YYYY-MM-DD` string, if the task has a deadline. */
  deadline?: string;
  /** Optional due time as a 24-hour `HH:MM` string (only meaningful with `deadline`). */
  deadlineTime?: string;
  /** Project this task belongs to (a folder id), if tagged to one. */
  folderId?: string;
  /** Budgeted amount in USD. A task with a budget set is a project budget line. */
  budget?: number;
  /** Amount spent so far in USD. */
  spend?: number;
  /**
   * Manual position within its column. Lower sorts higher; newly created tasks
   * get a large value so they land at the bottom. Reordering renormalizes a
   * column to 0, 1, 2, … See `reorderTasks` in `actions.ts`.
   */
  sortOrder?: number;
  /**
   * Ids of tasks that must be completed before this one can proceed (its
   * blockers). Surfaced on the board (blocked cards) and to Archon via
   * `list_tasks`, so completion order can be reasoned about. Empty when the task
   * has no dependencies.
   */
  blockedBy?: string[];
  /**
   * Knowledge-base documents connected to this task (the files it relates to).
   * Edited from the task modal, shown on the card, and read by Archon. Empty
   * when nothing is linked.
   */
  documents?: TaskDocument[];
}

/** A document linked to a task, with just enough to display + reference it. */
export interface TaskDocument {
  id: string;
  name: string;
  /** KB file type (e.g. "doc", "diagram"), when known. */
  type?: string;
}

export interface TaskColumn {
  status: TaskStatus;
  label: string;
}

/** Column definitions, left-to-right. */
export const TASK_COLUMNS: TaskColumn[] = [
  { status: "planned", label: "Planned" },
  { status: "priority", label: "Priority" },
  { status: "doing", label: "Doing" },
  { status: "done", label: "Done" },
];

export const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

/** Sentinel shown in the assignee dropdown for an unassigned task. */
export const UNASSIGNED = "Unassigned";

/**
 * Flatten a rich-text (HTML) description into a single line of plain text for
 * card previews. Returns "" for empty / whitespace-only bodies (including the
 * editor's empty "<p></p>").
 */
export function descriptionPreview(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  deadline: string | null;
  deadline_time: string | null;
  folder_id: string | null;
  budget: number | null;
  spend: number | null;
  sort_order: number | null;
  blocked_by: string[] | null;
}

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status,
    priority: r.priority,
    assignee: r.assignee ?? undefined,
    deadline: r.deadline ?? undefined,
    deadlineTime: r.deadline_time ? r.deadline_time.slice(0, 5) : undefined,
    folderId: r.folder_id ?? undefined,
    budget: r.budget ?? undefined,
    spend: r.spend ?? undefined,
    sortOrder: r.sort_order ?? undefined,
    blockedBy: r.blocked_by ?? [],
  };
}

const TASK_COLS =
  "id, title, description, status, priority, assignee, deadline, deadline_time, folder_id, budget, spend, sort_order, blocked_by";

/**
 * Returns tasks in board order: within each column, by manual `sort_order`
 * ascending, then oldest-first as a tiebreaker — so newly added tasks (which
 * get a large `sort_order`) land at the bottom of their column. Pass a
 * `folderId` to scope to one project's tasks (the project Tasks/Budget tabs);
 * omit it for the global board (all tasks).
 */
export async function getTasks(folderId?: string): Promise<Task[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  let query = sb.from("tasks").select(TASK_COLS);
  if (folderId) query = query.eq("folder_id", folderId);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getTasks: ${error.message}`);
  const rows = (data ?? []) as TaskRow[];
  const documentsByTask = await loadTaskDocuments(
    sb,
    rows.map((r) => r.id)
  );
  return rows.map((r) => ({
    ...mapTask(r),
    documents: documentsByTask.get(r.id) ?? [],
  }));
}

/**
 * Linked documents for a set of tasks, keyed by task id. Resolves the
 * `task_files` links to file names/types in one pass. Returns an empty map (so
 * tasks still load) if the link table isn't there yet or the lookup fails —
 * document links are decoration, never a reason to break the board.
 */
async function loadTaskDocuments(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>,
  taskIds: string[]
): Promise<Map<string, TaskDocument[]>> {
  const byTask = new Map<string, TaskDocument[]>();
  if (taskIds.length === 0) return byTask;

  const { data: links, error } = await sb
    .from("task_files")
    .select("task_id, file_id")
    .in("task_id", taskIds);
  if (error || !links || links.length === 0) return byTask;

  const linkRows = links as { task_id: string; file_id: string }[];
  const fileIds = [...new Set(linkRows.map((l) => l.file_id))];
  const { data: files } = await sb
    .from("files")
    .select("id, name, type")
    .in("id", fileIds);
  const fileById = new Map(
    ((files ?? []) as { id: string; name: string; type: string | null }[]).map(
      (f) => [f.id, f]
    )
  );

  for (const link of linkRows) {
    const file = fileById.get(link.file_id);
    if (!file) continue;
    const list = byTask.get(link.task_id) ?? [];
    list.push({ id: file.id, name: file.name, type: file.type ?? undefined });
    byTask.set(link.task_id, list);
  }
  return byTask;
}

/**
 * Names of the team members a task can be assigned to, drawn from the `users`
 * table (the people in this workspace). Returns an empty list when Supabase is
 * unconfigured or the table is empty — the board still offers "Me". This
 * replaces the old contractor-based list, which assumed a `contractors` table
 * that isn't part of the live schema.
 */
export async function getAssignees(): Promise<string[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("users")
    .select("name")
    .order("name");
  // The users table is optional (single-user installs leave it empty); never
  // let a missing/empty roster break the Tasks page.
  if (error) return [];
  return (data ?? [])
    .map((r) => (r as { name: string | null }).name?.trim() ?? "")
    .filter(Boolean);
}
