import {
  getCalendarEvents,
  getTaskDeadlineEvents,
} from "@/lib/calendar/calendar";
import { toISO } from "@/lib/calendar/dates";
import { CalendarView } from "@/components/calendar/calendar-view";
import { requirePermission } from "@/lib/auth/permissions";

export default async function CalendarPage() {
  await requirePermission(["manage_personal_calendar", "manage_org_calendar"]);
  const [events, taskEvents] = await Promise.all([
    getCalendarEvents(),
    getTaskDeadlineEvents(),
  ]);
  const today = toISO(new Date());

  return <CalendarView today={today} events={[...events, ...taskEvents]} />;
}
