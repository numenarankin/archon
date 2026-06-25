import "server-only";

import {
  INVESTMENT_STAGES,
  OFFERING_STAGES,
  type KpiDashboard,
  type InvestmentStage,
  type StageCount,
  type OnboardingStep,
  type BounceRate,
} from "./kpis-types";

export {
  INVESTMENT_STAGES,
  OFFERING_STAGES,
  type KpiSummary,
  type InvestmentStage,
  type OfferingStage,
  type StageCount,
  type PageTraffic,
  type BounceRate,
  type OnboardingStep,
  type DailyMetric,
  type KpiDashboard,
} from "./kpis-types";

/**
 * Empty dashboard: a zeroed summary, every lifecycle stage present at count 0,
 * and empty series. Rendered when the data source is unreachable, so the charts
 * still show their full structure (stages, axes, legends) with empty states
 * instead of disappearing.
 */
const EMPTY: KpiDashboard = {
  summary: { liveIssuers: 0, liveInvestors: 0 },
  investmentLifecycle: INVESTMENT_STAGES.map((stage) => ({ stage, count: 0 })),
  offeringLifecycle: OFFERING_STAGES.map((stage) => ({ stage, count: 0 })),
  pageTraffic: [],
  bounce: { rate: 0, bounced: 0, sessions: 0 },
  onboarding: [],
  daily: [],
};

/** Base URL of the Numena platform app + the internal-metrics bearer token. */
const NUMENA_API_BASE_URL =
  process.env.NUMENA_API_BASE_URL ?? "http://localhost:3000";
const INTERNAL_METRICS_SECRET = process.env.INTERNAL_METRICS_SECRET;

/**
 * Fetch one token-gated internal-metrics endpoint. Server-only: the secret is a
 * non-`NEXT_PUBLIC` env var, so it never reaches the browser. Throws on a
 * missing token or a non-2xx response (the caller falls back to EMPTY).
 */
async function fetchMetric<T>(path: string): Promise<T> {
  if (!INTERNAL_METRICS_SECRET) {
    throw new Error("INTERNAL_METRICS_SECRET not set");
  }
  const res = await fetch(
    `${NUMENA_API_BASE_URL}/api/internal/metrics/${path}`,
    {
      headers: { Authorization: `Bearer ${INTERNAL_METRICS_SECRET}` },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`internal/metrics/${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ---- Response shapes (only the fields we consume) ---------------------------

interface OverviewResponse {
  issuers: { liveIssuers: number };
  investors: { liveInvestors: number };
  investments: { byStatus: Record<string, number> };
  funnels: {
    onboarding: {
      stages: {
        signups: number;
        kycVerified: number;
        accredVerified: number;
        onboarded: number;
        firstInvestment: number;
      };
    };
  };
  timeseries: {
    date: string;
    investments: number;
    signups: number;
    raised: number;
  }[];
}

interface PageViewsResponse {
  topPaths: { path: string; views: number }[];
}

interface VisitorsResponse {
  sessions: { date: string; count: number }[];
  bounce: { date: string; rate: number }[];
}

// ---- Mapping numena's API onto the dashboard shape --------------------------

/** numena investment status → the dashboard's lifecycle stage. */
const INVESTMENT_STATUS_TO_STAGE: Record<string, InvestmentStage> = {
  created: "started",
  funded: "signed",
  settled: "settled",
  canceled: "canceled",
  cancelled: "canceled",
};

function toInvestmentLifecycle(byStatus: Record<string, number>): StageCount[] {
  const counts: Record<InvestmentStage, number> = {
    started: 0,
    signed: 0,
    settled: 0,
    canceled: 0,
  };
  for (const [status, n] of Object.entries(byStatus)) {
    const stage = INVESTMENT_STATUS_TO_STAGE[status.toLowerCase()];
    if (stage) counts[stage] += n;
  }
  return INVESTMENT_STAGES.map((stage) => ({ stage, count: counts[stage] }));
}

function toOnboarding(
  stages: OverviewResponse["funnels"]["onboarding"]["stages"]
): OnboardingStep[] {
  const ordered = [
    { step: "Signed up", entered: stages.signups },
    { step: "KYC verified", entered: stages.kycVerified },
    { step: "Accredited", entered: stages.accredVerified },
    { step: "Onboarded", entered: stages.onboarded },
    { step: "First investment", entered: stages.firstInvestment },
  ];
  return ordered.map((s, i) => ({
    step: s.step,
    entered: s.entered,
    // "completed" = how many advanced to the next step.
    completed: i < ordered.length - 1 ? ordered[i + 1].entered : s.entered,
  }));
}

function toBounce(v: VisitorsResponse): BounceRate {
  const sessionsByDate = new Map(v.sessions.map((s) => [s.date, s.count]));
  const sessions = v.sessions.reduce((sum, s) => sum + s.count, 0);
  const bounced = v.bounce.reduce(
    (sum, b) => sum + b.rate * (sessionsByDate.get(b.date) ?? 0),
    0
  );
  return {
    sessions,
    bounced: Math.round(bounced),
    rate: sessions > 0 ? bounced / sessions : 0,
  };
}

/**
 * The Numena KPI dashboard dataset.
 *
 * Wired to the Numena platform's token-gated internal metrics API
 * (`/api/internal/metrics/*`, bearer = INTERNAL_METRICS_SECRET, server-only).
 * Fetches overview + page-views + visitors in parallel and maps them onto the
 * `KpiDashboard` shape. `offeringLifecycle` stays zeroed — the API exposes no
 * offering status breakdown — so that one chart keeps its empty state.
 *
 * Falls back to an empty dashboard (the page still renders) when the API is
 * unreachable, the token is missing, or a response is malformed.
 */
export async function getKpiDashboard(): Promise<KpiDashboard> {
  try {
    const [overview, pageViews, visitors] = await Promise.all([
      fetchMetric<OverviewResponse>("overview"),
      fetchMetric<PageViewsResponse>("page-views"),
      fetchMetric<VisitorsResponse>("visitors"),
    ]);

    return {
      ...EMPTY,
      summary: {
        liveIssuers: overview.issuers.liveIssuers,
        liveInvestors: overview.investors.liveInvestors,
      },
      investmentLifecycle: toInvestmentLifecycle(overview.investments.byStatus),
      onboarding: toOnboarding(overview.funnels.onboarding.stages),
      daily: overview.timeseries.map((t) => ({
        date: t.date,
        investments: t.investments,
        signups: t.signups,
        amountRaised: t.raised,
      })),
      pageTraffic: (pageViews.topPaths ?? []).map((p) => ({
        page: p.path,
        users: p.views,
      })),
      bounce: toBounce(visitors),
    };
  } catch (err) {
    console.warn(
      "[kpis] internal metrics fetch failed, showing empty dashboard:",
      err
    );
    return EMPTY;
  }
}
