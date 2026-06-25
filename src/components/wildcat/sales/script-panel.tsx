"use client";

import { useState } from "react";
import { ChevronDownIcon, ScrollTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ObjectionCard } from "@/components/wildcat/sales/objection-card";
import type { Objection } from "@/lib/wildcat/sales";

/**
 * Left rail of the call card: the collapsible opening script, with the
 * objection-handling cards tucked underneath for quick access mid-call.
 */
export function ScriptPanel({
  script,
  objections,
}: {
  script: string;
  objections: Objection[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-0 flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-left"
      >
        <ScrollTextIcon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Opening script
        </span>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-3.5 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-3 pb-3">
          <p className="rounded-md bg-muted/50 p-2.5 text-xs leading-relaxed text-foreground">
            {script}
          </p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Objections
            </p>
            <div className="flex flex-col gap-1">
              {objections.map((o) => (
                <ObjectionCard key={o.id} objection={o} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
