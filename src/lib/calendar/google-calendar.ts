import "server-only";

import { hasGoogleAuth, getGoogleAccessToken } from "@/lib/google/auth";
import { addDays } from "@/lib/calendar/dates";
import type { CalendarEvent, EventCategory } from "@/lib/calendar/calendar";

/**
 * Google Calendar client (Calendar REST API v3, via `fetch` — no extra deps).
 *
 * Reads and writes events on the user's primary calendar using the same
 * Google Workspace OAuth credentials as Gmail. When unconfigured,
 * `hasGoogleCalendar()` is false and the Calendar page shows an empty grid.
 * To enable, add the Calendar scope when authorizing — see `docs/gmail.md`:
 *   https://www.googleapis.com/auth/calendar
 */

const CALENDAR_API =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Cap on events pulled for the visible window. */
const MAX_RESULTS = 2500;

/** Whether Google Workspace credentials are present. */
export const hasGoogleCalendar = hasGoogleAuth;

interface GoogleEventDateTime {
  /** All-day events: `YYYY-MM-DD`. */
  date?: string;
  /** Timed events: RFC 3339, e.g. `2026-06-22T09:30:00-05:00`. */
  dateTime?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  attendees?: { email?: string; displayName?: string }[];
}

/** The IANA timezone events are created in (the server's), for write payloads. */
function serverTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Map a Google event to our `CalendarEvent`. Returns null if it has no start. */
function mapGoogleEvent(e: GoogleEvent): CalendarEvent | null {
  const start = e.start;
  if (!start) return null;

  const allDay = Boolean(start.date);
  // For timed events the RFC 3339 string is `YYYY-MM-DDTHH:MM:SS±OFFSET`; the
  // leading 10 chars are the date and chars 11–16 are the local wall-clock time.
  const date = allDay ? (start.date as string) : (start.dateTime ?? "").slice(0, 10);
  if (!date) return null;

  const startTime = allDay ? undefined : (start.dateTime ?? "").slice(11, 16);
  const endTime =
    allDay || !e.end?.dateTime ? undefined : e.end.dateTime.slice(11, 16);

  const people = (e.attendees ?? [])
    .map((a) => a.displayName || a.email || "")
    .filter(Boolean);

  return {
    id: e.id,
    title: e.summary || "(no title)",
    date,
    allDay,
    start: startTime,
    end: endTime,
    // Google has no operations category; default to "office".
    category: "office" as EventCategory,
    location: e.location || undefined,
    people: people.length ? people : undefined,
    description: e.description || undefined,
  };
}

/** List events on the primary calendar within an inclusive `YYYY-MM-DD` range. */
export async function listGoogleCalendarEvents(
  fromDate: string,
  toDate: string
): Promise<CalendarEvent[]> {
  const token = await getGoogleAccessToken();
  const params = new URLSearchParams({
    timeMin: `${fromDate}T00:00:00Z`,
    timeMax: `${toDate}T23:59:59Z`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_RESULTS),
  });

  const res = await fetch(`${CALENDAR_API}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar list failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { items?: GoogleEvent[] };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map(mapGoogleEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

export interface GoogleCalendarEventInput {
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  allDay: boolean;
  /** `HH:MM` (timed events only). */
  start: string;
  /** `HH:MM` (timed events only). */
  end: string;
  location: string;
  people: string[];
  description: string;
}

/** Build a Google event resource from the modal's fields. */
function toGoogleEvent(input: GoogleCalendarEventInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    summary: input.title || "Untitled event",
    location: input.location || undefined,
    description: input.description || undefined,
    attendees: input.people.length
      ? input.people.map((name) => ({ displayName: name }))
      : undefined,
  };

  if (input.allDay) {
    // All-day end date is exclusive in the Google API, so add a day.
    base.start = { date: input.date };
    base.end = { date: addDays(new Date(`${input.date}T00:00:00`), 1).toISOString().slice(0, 10) };
  } else {
    const tz = serverTimeZone();
    const startTime = input.start || "09:00";
    const endTime = input.end || input.start || "10:00";
    base.start = { dateTime: `${input.date}T${startTime}:00`, timeZone: tz };
    base.end = { dateTime: `${input.date}T${endTime}:00`, timeZone: tz };
  }

  return base;
}

/** Create an event on the primary calendar. */
export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<void> {
  const token = await getGoogleAccessToken();
  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(toGoogleEvent(input)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar create failed (${res.status}): ${detail}`);
  }
}

/** Update an existing event by id (full patch of editable fields). */
export async function updateGoogleCalendarEvent(
  id: string,
  input: GoogleCalendarEventInput
): Promise<void> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${CALENDAR_API}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(toGoogleEvent(input)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar update failed (${res.status}): ${detail}`);
  }
}
