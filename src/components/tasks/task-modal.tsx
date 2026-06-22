"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDescriptionEditor } from "@/components/tasks/task-description-editor";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  TASK_COLUMNS,
  TASK_PRIORITIES,
  UNASSIGNED,
  descriptionPreview,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/tasks";

export type NewTask = Omit<Task, "id">;

/** Keep only number-ish input (digits + a single dot) for amount fields. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  // Allow only the first dot.
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

interface Option {
  value: string;
  label: string;
}

/** Compact value picker for the meta sidebar, built on the shadcn dropdown. */
function MetaDropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        }
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TaskModalProps {
  open: boolean;
  /** "add" creates a new task; "edit" views/edits an existing one (Save). */
  mode: "add" | "edit";
  onClose: () => void;
  onSubmit: (task: NewTask) => void;
  /** Existing task to seed the form from in "edit" mode. */
  task?: Task | null;
  /** Selectable assignees ("Me" plus contractors from the People page). */
  assignees: string[];
  /** Default column for a newly added task. */
  defaultStatus?: TaskStatus;
}

/**
 * Shared create/edit task modal. Edits are held in local state and only
 * propagate to the board when the user clicks Add Task / Save — closing or
 * cancelling discards them.
 */
export function TaskModal({
  open,
  mode,
  onClose,
  onSubmit,
  task,
  assignees,
  defaultStatus = "planned",
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string>(UNASSIGNED);
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [deadline, setDeadline] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  // Budget / spend held as strings so the field can be empty (no budget line).
  const [budget, setBudget] = useState("");
  const [spend, setSpend] = useState("");
  // Bumped on each open so the (uncontrolled) editor remounts with fresh seed.
  const [editorKey, setEditorKey] = useState(0);

  // Seed the form each time the modal opens — from the task in edit mode, or
  // clean defaults in add mode.
  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setAssignee(task?.assignee ?? UNASSIGNED);
      setPriority(task?.priority ?? "Medium");
      setStatus(task?.status ?? defaultStatus);
      setDeadline(task?.deadline ?? "");
      setDeadlineTime(task?.deadlineTime ?? "");
      setBudget(task?.budget != null ? String(task.budget) : "");
      setSpend(task?.spend != null ? String(task.spend) : "");
      setEditorKey((k) => k + 1);
    }
  }, [open, task, defaultStatus]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // Only keep the rich-text body when it has real content (an empty editor
    // still emits "<p></p>").
    const hasBody = descriptionPreview(description).length > 0;
    const budgetNum = budget.trim() === "" ? undefined : Number(budget);
    const spendNum = spend.trim() === "" ? undefined : Number(spend);
    onSubmit({
      title: trimmed,
      description: hasBody ? description : undefined,
      assignee: assignee === UNASSIGNED ? undefined : assignee,
      priority,
      status,
      deadline: deadline || undefined,
      // Time is only kept when a deadline date is set.
      deadlineTime: deadline && deadlineTime ? deadlineTime : undefined,
      budget: budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : undefined,
      spend: spendNum != null && !Number.isNaN(spendNum) ? spendNum : undefined,
    });
    onClose();
  }

  const isEdit = mode === "edit";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Task" : "Add Task"}
      description={
        isEdit
          ? "Make changes, then click Save to apply them."
          : "Fill in the details, then choose where it lands."
      }
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-[58vh] min-h-0">
          {/* Left — title + rich-text description */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 border-r px-5 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Title</span>
              <Input
                className="h-11"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to get done?"
              />
            </label>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">Description</span>
              <TaskDescriptionEditor
                key={editorKey}
                initialContent={task?.description ?? ""}
                onChange={setDescription}
              />
            </div>
          </div>

          {/* Right — meta, stacked in a single column */}
          <div className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Assignee</span>
              <MetaDropdown
                ariaLabel="Assignee"
                value={assignee}
                options={[
                  { value: UNASSIGNED, label: UNASSIGNED },
                  ...assignees.map((person) => ({
                    value: person,
                    label: person,
                  })),
                ]}
                onChange={setAssignee}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Priority</span>
              <MetaDropdown
                ariaLabel="Priority"
                value={priority}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                onChange={(value) => setPriority(value as TaskPriority)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Status</span>
              <MetaDropdown
                ariaLabel="Status"
                value={status}
                options={TASK_COLUMNS.map((c) => ({
                  value: c.status,
                  label: c.label,
                }))}
                onChange={(value) => setStatus(value as TaskStatus)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Deadline</span>
              <Input
                type="date"
                className="h-11"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  // Drop any time once the date is cleared.
                  if (!e.target.value) setDeadlineTime("");
                }}
              />
              <Input
                type="time"
                className="h-11"
                aria-label="Deadline time (optional)"
                disabled={!deadline}
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Budget</span>
              <Input
                inputMode="decimal"
                className="h-11"
                aria-label="Budget (USD)"
                placeholder="$ — set to add to the project budget"
                value={budget}
                onChange={(e) => setBudget(sanitizeAmount(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Spend</span>
              <Input
                inputMode="decimal"
                className="h-11"
                aria-label="Spend (USD)"
                placeholder="$ spent so far"
                value={spend}
                onChange={(e) => setSpend(sanitizeAmount(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            {isEdit ? "Save" : "Add Task"}
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
