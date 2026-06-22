"use server";

import { revalidatePath } from "next/cache";
import {
  hasGoogleCalendar,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar";

/** The editable fields exposed by the event modal. */
export interface CalendarEventInput {
  title: string;
  /** Date as an ISO `YYYY-MM-DD` string. */
  date: string;
  /** True for all-day items; `start`/`end` are ignored when true. */
  allDay: boolean;
  /** Start time as a 24-hour `HH:MM` string ("" when all-day). */
  start: string;
  /** End time as a 24-hour `HH:MM` string ("" when all-day). */
  end: string;
  location: string;
  people: string[];
  description: string;
}

/** Create a new event from the modal's fields on the user's Google Calendar. */
export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<void> {
  // No Google Workspace connected: nothing to write to. The UI still closes the
  // modal; the event simply isn't persisted until Calendar is wired up.
  if (!(await hasGoogleCalendar())) return;
  await createGoogleCalendarEvent(input);
  revalidatePath("/calendar");
}

/** Update an existing Google Calendar event's editable fields. */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput
): Promise<void> {
  if (!(await hasGoogleCalendar())) return;
  await updateGoogleCalendarEvent(id, input);
  revalidatePath("/calendar");
}
