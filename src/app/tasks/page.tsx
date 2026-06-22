import { getTasks } from "@/lib/tasks/tasks";
import { getContractors } from "@/lib/people/people";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { requirePermission } from "@/lib/auth/permissions";

export default async function TasksPage() {
  await requirePermission("manage_tasks");
  const [tasks, contractors] = await Promise.all([
    getTasks(),
    getContractors(),
  ]);

  // Assignable people: the current user plus every contractor on the People page.
  const assignees = ["Me", ...contractors.map((c) => c.name)];

  return <TasksBoard tasks={tasks} assignees={assignees} />;
}
