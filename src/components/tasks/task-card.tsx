"use client";

import type { Ref } from "react";
import { useDrag } from "react-dnd";
import { CalendarClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { to12Hour } from "@/lib/calendar/dates";
import { descriptionPreview, type Task, type TaskPriority } from "@/lib/tasks/tasks";

/** Drag item type shared between cards and columns. */
export const TASK_DND_TYPE = "task";

export interface TaskDragItem {
  id: string;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
};

const deadlineFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Jun 20" or "Jun 20, 2:30 PM" for a task deadline. */
function formatDeadline(date: string, time?: string): string {
  const day = deadlineFormatter.format(new Date(`${date}T00:00:00Z`));
  return time ? `${day}, ${to12Hour(time)}` : day;
}

export function TaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
}) {
  const [{ isDragging }, dragRef] = useDrag<
    TaskDragItem,
    unknown,
    { isDragging: boolean }
  >(() => ({
    type: TASK_DND_TYPE,
    item: { id: task.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [task.id]);

  const preview = descriptionPreview(task.description);

  return (
    <div
      ref={dragRef as unknown as Ref<HTMLDivElement>}
      onClick={() => onOpen?.(task)}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-foreground/20",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">
        {task.title}
      </p>
      {preview && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {preview}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            PRIORITY_STYLES[task.priority]
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {task.priority}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {task.deadline && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              <span className="tabular-nums">
                {formatDeadline(task.deadline, task.deadlineTime)}
              </span>
            </span>
          )}
          {task.assignee && (
            <span className="truncate text-xs text-muted-foreground">
              {task.assignee}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
