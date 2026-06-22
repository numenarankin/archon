"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMonths, fromISO, toISO } from "@/lib/calendar/dates";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekGrid } from "@/components/calendar/week-grid";
import {
  EventModal,
  type EventFormValues,
} from "@/components/calendar/event-modal";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/calendar/actions";
import type { CalendarEvent } from "@/lib/calendar/calendar";

export type CalendarViewMode = "month" | "week";

/** What the modal is currently doing: creating a new event or editing one. */
type ModalState =
  | { mode: "create" }
  | { mode: "edit"; event: CalendarEvent }
  | null;

function toFormValues(event: CalendarEvent): EventFormValues {
  return {
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    start: event.start ?? "",
    end: event.end ?? "",
    location: event.location ?? "",
    people: event.people ?? [],
    description: event.description ?? "",
  };
}

/** A clean event seeded on the focused day, for the create modal. */
function createDefaults(date: string): EventFormValues {
  return {
    title: "",
    date,
    allDay: true,
    start: "",
    end: "",
    location: "",
    people: [],
    description: "",
  };
}

export function CalendarView({
  today,
  events,
}: {
  today: string;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<CalendarViewMode>("month");
  const [cursorISO, setCursorISO] = useState(today);
  const [modal, setModal] = useState<ModalState>(null);
  const cursor = useMemo(() => fromISO(cursorISO), [cursorISO]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          Number(b.allDay) - Number(a.allDay) ||
          (a.start ?? "").localeCompare(b.start ?? "")
      );
    }
    return map;
  }, [events]);

  function navigate(delta: number) {
    setCursorISO((iso) => {
      const date = fromISO(iso);
      return view === "month"
        ? toISO(addMonths(date, delta))
        : toISO(addDays(date, delta * 7));
    });
  }

  function handleEventClick(event: CalendarEvent) {
    // Task deadlines are read-only here — send the user to the board instead of
    // opening the event editor (there's no calendar_events row to edit).
    if (event.taskId) {
      router.push("/tasks");
      return;
    }
    setModal({ mode: "edit", event });
  }

  function handleSubmit(values: EventFormValues) {
    const editId = modal?.mode === "edit" ? modal.event.id : null;
    startTransition(async () => {
      try {
        if (editId) {
          await updateCalendarEvent(editId, values);
        } else {
          await createCalendarEvent(values);
        }
        router.refresh();
      } catch (error) {
        console.error("Failed to save calendar event", error);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CalendarToolbar
        view={view}
        onView={setView}
        cursor={cursor}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onNewEvent={() => setModal({ mode: "create" })}
      />
      {view === "month" ? (
        <MonthGrid
          cursor={cursor}
          today={today}
          eventsByDate={eventsByDate}
          onEventClick={handleEventClick}
        />
      ) : (
        <WeekGrid
          cursor={cursor}
          today={today}
          eventsByDate={eventsByDate}
          onEventClick={handleEventClick}
        />
      )}

      <EventModal
        open={modal !== null}
        mode={modal?.mode ?? "create"}
        initial={
          modal?.mode === "edit"
            ? toFormValues(modal.event)
            : createDefaults(cursorISO)
        }
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
