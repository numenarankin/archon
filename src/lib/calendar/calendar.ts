import { addDays, toISO } from "@/lib/calendar/dates";
import { getTasks } from "@/lib/tasks/tasks";
import {
  hasGoogleCalendar,
  listGoogleCalendarEvents,
} from "@/lib/calendar/google-calendar";

/**
 * Operations calendar events — field work, maintenance, hauling, regulatory
 * deadlines, and office items. Times are local `HH:MM` strings; all-day items
 * omit them.
 */

/** Broad category for an event, used for subtle visual differentiation. */
export type EventCategory =
  | "production"
  | "maintenance"
  | "logistics"
  | "compliance"
  | "office";

export interface CalendarEvent {
  id: string;
  title: string;
  /** Date as an ISO `YYYY-MM-DD` string. */
  date: string;
  /** True for all-day items; `start`/`end` are omitted when true. */
  allDay: boolean;
  /** Start time as a 24-hour `HH:MM` string (timed events only). */
  start?: string;
  /** End time as a 24-hour `HH:MM` string (timed events only). */
  end?: string;
  category: EventCategory;
  /** Optional location / lease the event takes place at. */
  location?: string;
  /** Optional attendees. */
  people?: string[];
  /** Optional free-form notes. */
  description?: string;
  /**
   * Set when this entry is a task deadline surfaced on the calendar rather than
   * a real `calendar_events` row. Such entries are read-only here (clicking
   * them links back to the task) and cannot be edited via the event modal.
   */
  taskId?: string;
}

/** How far before / after today to load events for the month / week views. */
const WINDOW_BEFORE_DAYS = 60;
const WINDOW_AFTER_DAYS = 120;

/**
 * Returns calendar events within a window around the current date, so month
 * and week views can page without refetching. Reads from the user's Google
 * Calendar when Workspace credentials are configured; otherwise returns an
 * empty list (the page renders an empty grid).
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (!(await hasGoogleCalendar())) return [];

  const today = new Date();
  const from = toISO(addDays(today, -WINDOW_BEFORE_DAYS));
  const to = toISO(addDays(today, WINDOW_AFTER_DAYS));

  return listGoogleCalendarEvents(from, to);
}

/**
 * Tasks that carry a deadline, surfaced as read-only calendar entries so due
 * dates show up alongside scheduled events. Timed deadlines render at their
 * time; date-only deadlines render as all-day.
 */
export async function getTaskDeadlineEvents(): Promise<CalendarEvent[]> {
  const tasks = await getTasks();
  return tasks
    .filter((task) => task.deadline)
    .map((task) => ({
      id: `task-${task.id}`,
      taskId: task.id,
      title: task.title,
      date: task.deadline as string,
      allDay: !task.deadlineTime,
      start: task.deadlineTime,
      category: "compliance" as EventCategory,
    }));
}
