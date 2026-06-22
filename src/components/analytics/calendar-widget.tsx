import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CATEGORY_DOT } from "@/components/calendar/event-chip";
import type { CalendarEvent } from "@/lib/calendar/calendar";

const MAX_ITEMS = 6;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Today" / "Tomorrow" / "Mon, Jun 16" relative to the given ISO date. */
function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  // today + 1 day, compared as ISO strings (both UTC midnight).
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (date === next.toISOString().slice(0, 10)) return "Tomorrow";
  return weekdayFormatter.format(new Date(`${date}T00:00:00Z`));
}

/** Formats a 24-hour `HH:MM` as "6:00 AM". */
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function CalendarWidget({
  events,
  today,
}: {
  events: CalendarEvent[];
  today: string;
}) {
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) =>
      `${a.date}T${a.start ?? "00:00"}`.localeCompare(
        `${b.date}T${b.start ?? "00:00"}`
      )
    )
    .slice(0, MAX_ITEMS);

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-muted-foreground" />
            Upcoming
          </span>
          <Link
            href="/calendar"
            className="text-xs font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            View calendar
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled.
          </p>
        ) : (
          <ul className="flex flex-col">
            {upcoming.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 border-b py-2.5 last:border-b-0"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${CATEGORY_DOT[event.category]}`}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {event.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayLabel(event.date, today)}
                    {!event.allDay && event.start
                      ? ` · ${formatTime(event.start)}`
                      : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
