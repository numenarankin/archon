import { getTasks, getAssignees } from "@/lib/tasks/tasks";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { requirePermission } from "@/lib/auth/permissions";

export default async function TasksPage() {
  await requirePermission("view_tasks");
  const [tasks, team] = await Promise.all([getTasks(), getAssignees()]);

  // Assignable people: the current user plus every workspace member, de-duped.
  const assignees = ["Me", ...team.filter((name) => name !== "Me")];

  return <TasksBoard tasks={tasks} assignees={assignees} />;
}
