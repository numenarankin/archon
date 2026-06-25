"use client";

import { useCallback, useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import {
  QUEUE_DND_TYPE,
  statusMeta,
  type Prospect,
  type WeekdayKey,
} from "@/lib/wildcat/sales";

export interface QueueDragItem {
  id: string;
  day: WeekdayKey;
}

/**
 * Deliberately short (single row) — an SDR works ~90 of these a day, so the
 * column has to stay scannable. Name + company on the left, status dot, phone.
 */
export function QueueCard({
  prospect,
  onReorder,
}: {
  prospect: Prospect;
  onReorder: (
    dragId: string,
    targetId: string,
    placeAfter: boolean,
    day: WeekdayKey
  ) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, dragRef] = useDrag<
    QueueDragItem,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: QUEUE_DND_TYPE,
      item: { id: prospect.id, day: prospect.day },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [prospect.id, prospect.day]
  );

  const [, dropRef] = useDrop<QueueDragItem, { handled: boolean }, unknown>(
    () => ({
      accept: QUEUE_DND_TYPE,
      drop: () => ({ handled: true }),
      hover: (item, monitor) => {
        if (item.id === prospect.id) return;
        const node = ref.current;
        const offset = monitor.getClientOffset();
        if (!node || !offset) return;
        const rect = node.getBoundingClientRect();
        const placeAfter = offset.y - rect.top > rect.height / 2;
        onReorder(item.id, prospect.id, placeAfter, prospect.day);
        item.day = prospect.day;
      },
    }),
    [prospect.id, prospect.day, onReorder]
  );

  const attachRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef]
  );

  const status = statusMeta(prospect.status);

  return (
    <div
      ref={attachRef}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 shadow-sm transition-colors hover:border-foreground/20 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", status.dot)}
        title={status.label}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight text-foreground">
          {prospect.name}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {prospect.company}
          </span>
        </p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
        {prospect.phone}
      </span>
    </div>
  );
}
