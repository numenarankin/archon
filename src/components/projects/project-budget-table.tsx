"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { updateTask, type TaskInput } from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/tasks";

const CELL_INPUT =
  "w-full rounded bg-transparent px-1.5 py-1 outline-none placeholder:text-muted-foreground/50 focus:bg-muted focus:ring-1 focus:ring-ring";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Build the full task input for a save, preserving every non-budget field. */
function toInput(t: Task): TaskInput {
  return {
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee,
    deadline: t.deadline,
    deadlineTime: t.deadlineTime,
    folderId: t.folderId,
    budget: t.budget,
    spend: t.spend,
  };
}

interface ProjectBudgetTableProps {
  /** The project's tasks that have a budget set (each is one budget line). */
  tasks: Task[];
}

/**
 * Inline-editable budget table for a project. Each row is a task with a budget;
 * editing title / budget / spend writes back to the task (tasks are the storage
 * layer for budget). Remaining is derived. New budget lines are created by
 * adding a budget to a task in the Tasks tab — there's no add action here.
 */
export function ProjectBudgetTable({ tasks: initial }: ProjectBudgetTableProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [, startTransition] = useTransition();

  // Re-sync after a server refresh.
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  function change(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function commit(id: string) {
    const row = tasks.find((t) => t.id === id);
    if (!row) return;
    startTransition(async () => {
      try {
        await updateTask(id, toInput(row));
        router.refresh();
      } catch (error) {
        console.error("Failed to update budget", error);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  const totalBudget = tasks.reduce((s, t) => s + (t.budget ?? 0), 0);
  const totalSpend = tasks.reduce((s, t) => s + (t.spend ?? 0), 0);
  const totalRemaining = totalBudget - totalSpend;

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Title</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No budget items yet. Give a task a budget in the Tasks tab to
                add a line here.
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((t) => {
              const remaining = (t.budget ?? 0) - (t.spend ?? 0);
              return (
                <TableRow key={t.id} className="[&>td]:py-2">
                  <TableCell className="font-medium">
                    <input
                      value={t.title}
                      placeholder="Untitled"
                      onChange={(e) => change(t.id, { title: e.target.value })}
                      onBlur={() => commit(t.id)}
                      onKeyDown={handleKeyDown}
                      className={`${CELL_INPUT} font-medium`}
                      aria-label="Budget item title"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell
                      value={t.budget}
                      onValue={(n) => change(t.id, { budget: n })}
                      onCommit={() => commit(t.id)}
                      ariaLabel="Budget"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell
                      value={t.spend}
                      onValue={(n) => change(t.id, { spend: n })}
                      onCommit={() => commit(t.id)}
                      ariaLabel="Spend"
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      remaining < 0 ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {currency.format(remaining)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        {tasks.length > 0 && (
          <TableFooter>
            <TableRow className="[&>td]:py-3">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {currency.format(totalBudget)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {currency.format(totalSpend)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  totalRemaining < 0 ? "text-destructive" : "text-foreground"
                )}
              >
                {currency.format(totalRemaining)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

/**
 * Plain-text dollar amount input (no spinner arrows). Shows exactly what's typed
 * and renders empty for an unset/zero value so input isn't prefixed with a "0".
 */
function AmountCell({
  value,
  onValue,
  onCommit,
  ariaLabel,
}: {
  value: number | undefined;
  onValue: (n: number) => void;
  onCommit: () => void;
  ariaLabel: string;
}) {
  const display = (n: number | undefined) => (!n ? "" : String(n));
  const [text, setText] = useState(() => display(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(display(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={ariaLabel}
      placeholder="$0"
      className={`${CELL_INPUT} text-right tabular-nums`}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? 0 : Number(raw);
        if (!Number.isNaN(n)) onValue(n);
      }}
      onBlur={() => {
        focused.current = false;
        setText(display(value));
        onCommit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
