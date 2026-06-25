"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { QueueDayColumn } from "@/components/wildcat/sales/queue-day-column";
import { WEEKDAYS, type Prospect, type WeekdayKey } from "@/lib/wildcat/sales";

/** True when two lists hold the same prospects in the same order + day. */
function sameOrder(a: Prospect[], b: Prospect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].day !== b[i].day) return false;
  }
  return true;
}

export function QueueBoard({
  prospects,
  onChange,
}: {
  prospects: Prospect[];
  onChange: Dispatch<SetStateAction<Prospect[]>>;
}) {
  // Reposition the dragged card next to a target card, adopting its day.
  const handleReorder = useCallback(
    (dragId: string, targetId: string, placeAfter: boolean, day: WeekdayKey) => {
      onChange((prev) => {
        const dragged = prev.find((p) => p.id === dragId);
        if (!dragged) return prev;
        const without = prev.filter((p) => p.id !== dragId);
        const targetIdx = without.findIndex((p) => p.id === targetId);
        if (targetIdx === -1) return prev;
        const insertAt = placeAfter ? targetIdx + 1 : targetIdx;
        const next = [
          ...without.slice(0, insertAt),
          { ...dragged, day },
          ...without.slice(insertAt),
        ];
        return sameOrder(prev, next) ? prev : next;
      });
    },
    [onChange]
  );

  // Drop onto a day's empty space: send the card to the end of that day.
  const handleDropToEnd = useCallback(
    (dragId: string, day: WeekdayKey) => {
      onChange((prev) => {
        const dragged = prev.find((p) => p.id === dragId);
        if (!dragged) return prev;
        const without = prev.filter((p) => p.id !== dragId);
        const next = [...without, { ...dragged, day }];
        return sameOrder(prev, next) ? prev : next;
      });
    },
    [onChange]
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
        {WEEKDAYS.map((day) => (
          <QueueDayColumn
            key={day.key}
            day={day}
            prospects={prospects.filter((p) => p.day === day.key)}
            onDropToEnd={handleDropToEnd}
            onReorder={handleReorder}
          />
        ))}
      </div>
    </DndProvider>
  );
}
