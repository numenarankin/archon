"use client";

import type { Ref } from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { TaskCard, TASK_DND_TYPE, type TaskDragItem } from "@/components/tasks/task-card";
import type { Task, TaskColumn as TaskColumnDef } from "@/lib/tasks/tasks";

interface TaskColumnProps {
  column: TaskColumnDef;
  tasks: Task[];
  /** Ids of not-yet-done tasks, used to flag cards with open blockers. */
  openTaskIds: Set<string>;
  /** Drop onto the column body (not over a card): send the card to the end. */
  onDropToEnd: (taskId: string, status: TaskColumnDef["status"]) => void;
  /** Reposition the dragged card relative to a card in this column. */
  onReorder: (
    dragId: string,
    targetId: string,
    placeAfter: boolean,
    status: TaskColumnDef["status"]
  ) => void;
  /** Save the board order once a drag ends. */
  onPersist: () => void;
  onOpenTask: (task: Task) => void;
}

export function TaskColumn({
  column,
  tasks,
  openTaskIds,
  onDropToEnd,
  onReorder,
  onPersist,
  onOpenTask,
}: TaskColumnProps) {
  const [{ isOver }, dropRef] = useDrop<
    TaskDragItem,
    unknown,
    { isOver: boolean }
  >(() => ({
    accept: TASK_DND_TYPE,
    // A card's drop handler runs first; if it handled the drop (precise
    // position), don't also send the card to the end of the column.
    drop: (item, monitor) => {
      if (monitor.didDrop()) return;
      onDropToEnd(item.id, column.status);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  }), [column.status, onDropToEnd]);

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">
          {column.label}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>
      <div
        ref={dropRef as unknown as Ref<HTMLDivElement>}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-2 transition-colors",
          isOver && "bg-foreground/5 ring-1 ring-inset ring-foreground/15"
        )}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            openBlockerCount={
              (task.blockedBy ?? []).filter((id) => openTaskIds.has(id)).length
            }
            onOpen={onOpenTask}
            onReorder={onReorder}
            onPersist={onPersist}
          />
        ))}
        {tasks.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground/70">
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}
