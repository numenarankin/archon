"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskColumn } from "@/components/tasks/task-column";
import { TaskModal, type NewTask } from "@/components/tasks/task-modal";
import { createTask, reorderTasks, updateTask } from "@/lib/tasks/actions";
import { TASK_COLUMNS, type Task, type TaskStatus } from "@/lib/tasks/tasks";

/** True when two task lists have the same cards, in the same order + columns. */
function sameOrder(a: Task[], b: Task[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].status !== b[i].status) return false;
  }
  return true;
}

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

  // Mirror the latest tasks into a ref so the drag-end persist reads the order
  // settled by the (async) hover updates rather than a stale closure value.
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Re-sync from the server after a mutation refresh.
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  // Move the dragged card to just before/after a target card, adopting the
  // target's column. Runs live on hover; the no-op guard avoids re-renders when
  // the order hasn't actually changed.
  const handleReorder = useCallback(
    (dragId: string, targetId: string, placeAfter: boolean, status: TaskStatus) => {
      setTasks((prev) => {
        const dragged = prev.find((t) => t.id === dragId);
        if (!dragged) return prev;
        const without = prev.filter((t) => t.id !== dragId);
        const targetIdx = without.findIndex((t) => t.id === targetId);
        if (targetIdx === -1) return prev;
        const insertAt = placeAfter ? targetIdx + 1 : targetIdx;
        const next = [
          ...without.slice(0, insertAt),
          { ...dragged, status },
          ...without.slice(insertAt),
        ];
        return sameOrder(prev, next) ? prev : next;
      });
    },
    []
  );

  // Drop onto a column body (not over a card): move the card to that column's
  // end. Pushing to the flat array's tail puts it last within its column, since
  // each column renders its tasks in array order.
  const handleDropToEnd = useCallback((dragId: string, status: TaskStatus) => {
    setTasks((prev) => {
      const dragged = prev.find((t) => t.id === dragId);
      if (!dragged) return prev;
      const without = prev.filter((t) => t.id !== dragId);
      const next = [...without, { ...dragged, status }];
      return sameOrder(prev, next) ? prev : next;
    });
  }, []);

  // Persist the order once a drag ends: renormalize each column to 0, 1, 2, …
  // and save. Skips not-yet-saved optimistic cards (temporary local ids).
  const handlePersist = useCallback(() => {
    const counters: Record<string, number> = {};
    const items = tasksRef.current
      .filter((t) => !t.id.startsWith("task-local-"))
      .map((t) => {
        const sortOrder = counters[t.status] ?? 0;
        counters[t.status] = sortOrder + 1;
        return { id: t.id, status: t.status, sortOrder };
      });
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        await reorderTasks(items, folderId);
        router.refresh();
      } catch (error) {
        console.error("Failed to reorder tasks", error);
      }
    });
  }, [folderId, router]);

  // Ids of tasks that aren't done yet — a blocker still "counts" only while it's
  // open, so a card is blocked when any of its blockers is in this set.
  const openTaskIds = useMemo(
    () => new Set(tasks.filter((t) => t.status !== "done").map((t) => t.id)),
    [tasks]
  );

  const handleOpenTask = useCallback((task: Task) => setEditing(task), []);

  function handleAddTask(task: NewTask) {
    // Tag new tasks to the current project (no-op on the global board) and add
    // them at the bottom of their column, matching the server's create order.
    const full: NewTask = { ...task, folderId };
    setTasks((prev) => [...prev, { id: `task-local-${Date.now()}`, ...full }]);
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
              openTaskIds={openTaskIds}
              onDropToEnd={handleDropToEnd}
              onReorder={handleReorder}
              onPersist={handlePersist}
              onOpenTask={handleOpenTask}
            />
          ))}
        </div>
      </DndProvider>

      <TaskModal
        mode="add"
        open={addOpen}
        assignees={assignees}
        allTasks={tasks}
        searchFolderId={folderId}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddTask}
      />

      <TaskModal
        mode="edit"
        open={editing !== null}
        task={editing}
        assignees={assignees}
        allTasks={tasks}
        searchFolderId={folderId}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveTask}
      />
    </div>
  );
}
