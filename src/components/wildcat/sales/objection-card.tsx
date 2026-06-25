"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Objection } from "@/lib/wildcat/sales";

/** A small objection chip that expands in place to reveal the rebuttal. */
export function ObjectionCard({ objection }: { objection: Objection }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-md border bg-card transition-colors",
        open ? "border-foreground/20" : "hover:border-foreground/15"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
      >
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
        <span className="truncate text-[11px] font-medium text-foreground">
          {objection.trigger}
        </span>
      </button>
      {open && (
        <p className="px-2 pb-2 pl-[26px] text-[11px] leading-relaxed text-muted-foreground">
          {objection.response}
        </p>
      )}
    </div>
  );
}
