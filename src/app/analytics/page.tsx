import {
  getCalendarEvents,
  getTaskDeadlineEvents,
} from "@/lib/calendar/calendar";
import { toISO } from "@/lib/calendar/dates";
import { getCompanyAnalytics } from "@/lib/analytics/analytics";
import { CompanyProductionChart } from "@/components/analytics/company-production-chart";
import { ProductionByWellPie } from "@/components/analytics/production-by-well-pie";
import { CalendarWidget } from "@/components/analytics/calendar-widget";
import { ProductionLogTable } from "@/components/analytics/production-log-table";
import { requirePermission } from "@/lib/auth/permissions";

export default async function AnalyticsPage() {
  await requirePermission("view_analytics");
  const [{ monthly, byWell, log }, events, taskEvents] = await Promise.all([
    getCompanyAnalytics(),
    getCalendarEvents(),
    getTaskDeadlineEvents(),
  ]);
  const today = toISO(new Date());

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Analytics
      </h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: company production chart + full production log. */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CompanyProductionChart data={monthly} />
          <ProductionLogTable rows={log} />
        </div>

        {/* Right: production-by-well pie + calendar glance. */}
        <div className="flex flex-col gap-4">
          <ProductionByWellPie wells={byWell} />
          <CalendarWidget events={[...events, ...taskEvents]} today={today} />
        </div>
      </div>
    </div>
  );
}
