"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskColumn } from "@/components/tasks/task-column";
import { TaskModal, type NewTask } from "@/components/tasks/task-modal";
import { createTask, moveTask, updateTask } from "@/lib/tasks/actions";
import { TASK_COLUMNS, type Task, type TaskStatus } from "@/lib/tasks/tasks";

export function TasksBoard({
  tasks: initial,
  assignees,
  folderId,
  embedded = false,
}: {
  tasks: Task[];
  assignees: string[];
  /** When set, new tasks are tagged to this project (folder). */
  folderId?: string;
  /** Embedded in the project page: drop the page title (the tab menu owns it). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync from the server after a mutation refresh.
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  const handleDropTask = useCallback(
    (taskId: string, status: TaskStatus) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );
      startTransition(async () => {
        try {
          await moveTask(taskId, status);
          router.refresh();
        } catch (error) {
          console.error("Failed to move task", error);
        }
      });
    },
    [router]
  );

  const handleOpenTask = useCallback((task: Task) => setEditing(task), []);

  function handleAddTask(task: NewTask) {
    // Tag new tasks to the current project (no-op on the global board).
    const full: NewTask = { ...task, folderId };
    setTasks((prev) => [{ id: `task-local-${Date.now()}`, ...full }, ...prev]);
    startTransition(async () => {
      try {
        await createTask(full);
        router.refresh();
      } catch (error) {
        console.error("Failed to create task", error);
      }
    });
  }

  function handleSaveTask(task: NewTask) {
    if (!editing) return;
    const id = editing.id;
    // The modal doesn't edit the project tag — preserve the task's existing one.
    const full: NewTask = { ...task, folderId: editing.folderId };
    setTasks((prev) => prev.map((t) => (t.id === id ? { id, ...full } : t)));
    startTransition(async () => {
      try {
        await updateTask(id, full);
        router.refresh();
      } catch (error) {
        console.error("Failed to update task", error);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div
        className={cn(
          "flex flex-wrap items-center gap-4",
          embedded ? "justify-end" : "justify-between"
        )}
      >
        {!embedded && (
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Tasks
          </h1>
        )}
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Task
        </Button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
          {TASK_COLUMNS.map((column) => (
            <TaskColumn
              key={column.status}
              column={column}
              tasks={tasks.filter((t) => t.status === column.status)}
              onDropTask={handleDropTask}
              onOpenTask={handleOpenTask}
            />
          ))}
        </div>
      </DndProvider>

      <TaskModal
        mode="add"
        open={addOpen}
        assignees={assignees}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddTask}
      />

      <TaskModal
        mode="edit"
        open={editing !== null}
        task={editing}
        assignees={assignees}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveTask}
      />
    </div>
  );
}
