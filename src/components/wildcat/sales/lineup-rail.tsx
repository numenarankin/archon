"use client";

import { useCallback, useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LINEUP_DND_TYPE,
  statusMeta,
  type Prospect,
} from "@/lib/wildcat/sales";

interface LineupDragItem {
  id: string;
}

/**
 * Left column of the desk: the day's lineup. The active call sits flush and
 * highlighted; the rest fade back like a deck you're working through. Drag to
 * set the order before dial time.
 */
export function LineupRail({
  lineup,
  currentId,
  onPick,
  onReorder,
  onPersist,
}: {
  lineup: Prospect[];
  currentId: string | null;
  onPick: (id: string) => void;
  onReorder: (dragId: string, targetId: string, placeAfter: boolean) => void;
  onPersist?: () => void;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Lineup
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {lineup.length}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {lineup.map((p, i) => (
          <LineupCard
            key={p.id}
            prospect={p}
            index={i}
            active={p.id === currentId}
            onPick={onPick}
            onReorder={onReorder}
            onPersist={onPersist}
          />
        ))}
      </div>
    </div>
  );
}

function LineupCard({
  prospect,
  index,
  active,
  onPick,
  onReorder,
  onPersist,
}: {
  prospect: Prospect;
  index: number;
  active: boolean;
  onPick: (id: string) => void;
  onReorder: (dragId: string, targetId: string, placeAfter: boolean) => void;
  onPersist?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const [{ isDragging }, dragRef] = useDrag<
    LineupDragItem,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: LINEUP_DND_TYPE,
      item: { id: prospect.id },
      end: () => onPersist?.(),
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [prospect.id, onPersist]
  );

  const [, dropRef] = useDrop<LineupDragItem, unknown, unknown>(
    () => ({
      accept: LINEUP_DND_TYPE,
      hover: (item, monitor) => {
        if (item.id === prospect.id) return;
        const node = ref.current;
        const offset = monitor.getClientOffset();
        if (!node || !offset) return;
        const rect = node.getBoundingClientRect();
        const placeAfter = offset.y - rect.top > rect.height / 2;
        onReorder(item.id, prospect.id, placeAfter);
      },
    }),
    [prospect.id, onReorder]
  );

  const attachRef = useCallback(
    (node: HTMLButtonElement | null) => {
      ref.current = node;
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef]
  );

  const status = statusMeta(prospect.status);

  return (
    <button
      ref={attachRef}
      type="button"
      onClick={() => onPick(prospect.id)}
      className={cn(
        "group flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all",
        active
          ? "border-foreground/20 bg-card shadow-sm"
          : "border-transparent bg-card/40 opacity-70 hover:opacity-100",
        isDragging && "opacity-30"
      )}
    >
      <span className="w-4 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground/60">
        {index + 1}
      </span>
      <span className={cn("size-1.5 shrink-0 rounded-full", status.dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-tight text-foreground">
          {prospect.name}
        </span>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
          {prospect.company}
        </span>
      </span>
      <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50" />
    </button>
  );
}
