"use client";

import type { Ref } from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { QueueCard, type QueueDragItem } from "@/components/wildcat/sales/queue-card";
import {
  QUEUE_DND_TYPE,
  type Prospect,
  type WeekdayKey,
} from "@/lib/wildcat/sales";

interface QueueDayColumnProps {
  day: { key: WeekdayKey; label: string; short: string };
  prospects: Prospect[];
  onDropToEnd: (dragId: string, day: WeekdayKey) => void;
  onReorder: (
    dragId: string,
    targetId: string,
    placeAfter: boolean,
    day: WeekdayKey
  ) => void;
}

export function QueueDayColumn({
  day,
  prospects,
  onDropToEnd,
  onReorder,
}: QueueDayColumnProps) {
  const [{ isOver }, dropRef] = useDrop<QueueDragItem, unknown, { isOver: boolean }>(
    () => ({
      accept: QUEUE_DND_TYPE,
      drop: (item, monitor) => {
        if (monitor.didDrop()) return;
        onDropToEnd(item.id, day.key);
      },
      collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [day.key, onDropToEnd]
  );

  return (
    <div className="flex min-h-0 w-64 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">{day.label}</span>
        <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
          {prospects.length}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/70">calls</span>
      </div>
      <div
        ref={dropRef as unknown as Ref<HTMLDivElement>}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto rounded-lg p-2 transition-colors",
          isOver && "bg-foreground/5 ring-1 ring-inset ring-foreground/15"
        )}
      >
        {prospects.map((p) => (
          <QueueCard key={p.id} prospect={p} onReorder={onReorder} />
        ))}
        {prospects.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground/70">No calls</p>
        )}
      </div>
    </div>
  );
}
