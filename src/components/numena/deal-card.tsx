"use client";

import type { Ref } from "react";
import { useDrag } from "react-dnd";
import { CalendarClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/numena/pipeline";

/** Drag item type shared between cards and columns. */
export const DEAL_DND_TYPE = "deal";

export interface DealDragItem {
  id: string;
}

const valueFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Tint the probability chip by how likely the deal is to close. */
function probabilityStyle(probability?: number): string {
  if (probability == null) return "bg-muted text-muted-foreground";
  if (probability >= 70) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (probability >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function DealCard({
  deal,
  onOpen,
}: {
  deal: Deal;
  onOpen?: (deal: Deal) => void;
}) {
  const [{ isDragging }, dragRef] = useDrag<
    DealDragItem,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: DEAL_DND_TYPE,
      item: { id: deal.id },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [deal.id]
  );

  return (
    <div
      ref={dragRef as unknown as Ref<HTMLDivElement>}
      onClick={() => onOpen?.(deal)}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-foreground/20",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-foreground">
          {deal.name}
        </p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {valueFormatter.format(deal.value)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{deal.company}</p>
      {deal.note && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
          {deal.note}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            probabilityStyle(deal.probability)
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {deal.probability ?? 0}%
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {deal.closeDate && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              <span className="tabular-nums">
                {dateFormatter.format(new Date(`${deal.closeDate}T00:00:00Z`))}
              </span>
            </span>
          )}
          {deal.owner && (
            <span className="truncate text-xs text-muted-foreground">
              {deal.owner}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
