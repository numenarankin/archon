import { FlagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { to12Hour } from "@/lib/calendar/dates";
import type { CalendarEvent, EventCategory } from "@/lib/calendar/calendar";

/** Neutral category indicators — distinct shades within the grayscale palette. */
export const CATEGORY_DOT: Record<EventCategory, string> = {
  production: "bg-foreground",
  maintenance: "bg-foreground/60",
  logistics: "bg-muted-foreground",
  compliance: "bg-foreground/80",
  office: "bg-muted-foreground/45",
};

/**
 * Compact event pill used in the month grid and the week view's all-day band.
 */
export function EventChip({
  event,
  dimmed,
  onClick,
}: {
  event: CalendarEvent;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-[0.2rem] px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-accent",
        dimmed && "opacity-50"
      )}
    >
      {event.taskId ? (
        <FlagIcon className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            CATEGORY_DOT[event.category]
          )}
        />
      )}
      {!event.allDay && event.start && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {to12Hour(event.start)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {event.title}
      </span>
    </button>
  );
}
