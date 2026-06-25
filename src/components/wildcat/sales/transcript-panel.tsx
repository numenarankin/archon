"use client";

import { cn } from "@/lib/utils";
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import type { TranscriptLine } from "@/lib/wildcat/sales";

/**
 * Live call transcript on the right of the desk. Collapses to a thin rail so
 * the rep can reclaim the width when they'd rather just read the card.
 */
export function TranscriptPanel({
  lines,
  open,
  onToggle,
}: {
  lines: TranscriptLine[];
  open: boolean;
  onToggle: () => void;
}) {
  if (!open) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-3 rounded-xl border bg-card py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show transcript"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelRightOpenIcon className="size-4" />
        </button>
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Transcript
        </span>
        <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
      </div>
    );
  }

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
        <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Live transcript
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">01:24</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Hide transcript"
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelRightCloseIcon className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
              line.speaker === "rep"
                ? "self-end bg-primary/10 text-foreground"
                : "self-start bg-muted text-foreground"
            )}
          >
            <span className="mb-0.5 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {line.speaker === "rep" ? "You" : "Prospect"}
            </span>
            {line.text}
          </div>
        ))}
        <div className="flex items-center gap-1 self-start px-1 pt-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
