import { getKpiDashboard } from "@/lib/numena/kpis";
import { requirePermission } from "@/lib/auth/permissions";
import { KpiStatCards } from "@/components/numena/kpis/kpi-stat-cards";
import { DailyMetricsChart } from "@/components/numena/kpis/daily-metrics-chart";
import { LifecycleChart } from "@/components/numena/kpis/lifecycle-chart";
import { OnboardingFunnel } from "@/components/numena/kpis/onboarding-funnel";
import { PageTrafficChart } from "@/components/numena/kpis/page-traffic-chart";
import { BounceRateCard } from "@/components/numena/kpis/bounce-rate-card";

const INVESTMENT_STAGE_META: Record<string, { label: string; color: string }> = {
  started: { label: "Started", color: "#4169e1" },
  signed: { label: "Signed", color: "#d97706" },
  settled: { label: "Settled", color: "#059669" },
  canceled: { label: "Canceled", color: "#800000" },
};

const OFFERING_STAGE_META: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "#4169e1" },
  pending: { label: "Pending", color: "#d97706" },
  approved: { label: "Approved", color: "#059669" },
  canceled: { label: "Canceled", color: "#800000" },
  expired: { label: "Expired", color: "#6b7280" },
};

export default async function NumenaKpisPage() {
  await requirePermission("view_prospects");
  const data = await getKpiDashboard();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          KPIs
        </h1>
        <p className="text-sm text-muted-foreground">
          Live platform metrics across issuers, investors, offerings, and
          onboarding
        </p>
      </div>

      <KpiStatCards data={data} />

      <DailyMetricsChart data={data.daily} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LifecycleChart
          title="Investment Lifecycle"
          description="Investments by stage: started, signed, settled, canceled"
          data={data.investmentLifecycle}
          stageMeta={INVESTMENT_STAGE_META}
        />
        <LifecycleChart
          title="Offering Lifecycle"
          description="Offerings by stage: created, pending, approved, canceled, expired"
          data={data.offeringLifecycle}
          stageMeta={OFFERING_STAGE_META}
        />
      </div>

      <OnboardingFunnel data={data.onboarding} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PageTrafficChart data={data.pageTraffic} />
        </div>
        <BounceRateCard data={data.bounce} />
      </div>
    </div>
  );
}
