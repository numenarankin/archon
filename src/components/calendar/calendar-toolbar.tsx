"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MONTHS, MONTHS_SHORT, weekDays } from "@/lib/calendar/dates";
import type { CalendarViewMode } from "@/components/calendar/calendar-view";

function weekTitle(cursor: Date): string {
  const days = weekDays(cursor);
  const a = days[0];
  const b = days[6];
  const aMonth = MONTHS_SHORT[a.getMonth()];
  const bMonth = MONTHS_SHORT[b.getMonth()];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${aMonth} ${a.getDate()}, ${a.getFullYear()} – ${bMonth} ${b.getDate()}, ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${aMonth} ${a.getDate()} – ${bMonth} ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${aMonth} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
}

function ViewToggle({
  view,
  onView,
}: {
  view: CalendarViewMode;
  onView: (view: CalendarViewMode) => void;
}) {
  return (
    <div className="flex h-8 items-center rounded-lg bg-muted p-0.5">
      {(["month", "week"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onView(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium capitalize text-muted-foreground transition-colors hover:text-foreground",
            view === value &&
              "bg-background text-foreground shadow-sm hover:text-foreground"
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function CalendarToolbar({
  view,
  onView,
  cursor,
  onPrev,
  onNext,
  onNewEvent,
}: {
  view: CalendarViewMode;
  onView: (view: CalendarViewMode) => void;
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  onNewEvent: () => void;
}) {
  const title =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : weekTitle(cursor);

  return (
    <div className="grid h-14 shrink-0 grid-cols-3 items-center border-b px-4">
      <div className="flex justify-start">
        <ViewToggle view={view} onView={onView} />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous"
          onClick={onPrev}
        >
          <ChevronLeftIcon />
        </Button>
        <h1 className="text-center font-heading text-lg font-semibold tracking-tight">
          {title}
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next"
          onClick={onNext}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={onNewEvent}
          className="bg-black text-white hover:bg-neutral-800"
        >
          <PlusIcon />
          New Event
        </Button>
      </div>
    </div>
  );
}
