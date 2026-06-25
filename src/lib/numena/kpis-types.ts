/**
 * Numena KPI dashboard types. PURE module (no server imports) so the client
 * chart components can import these shapes without pulling the server-only data
 * layer into the browser bundle. Server-side data access lives in `./kpis`.
 */

/** Headline counts shown as stat cards. */
export interface KpiSummary {
  /** Issuers currently live on the platform. */
  liveIssuers: number;
  /** Investors currently live on the platform. */
  liveInvestors: number;
}

/** Stages an investment moves through, in order. */
export const INVESTMENT_STAGES = [
  "started",
  "signed",
  "settled",
  "canceled",
] as const;
export type InvestmentStage = (typeof INVESTMENT_STAGES)[number];

/** Stages an offering moves through, in order. */
export const OFFERING_STAGES = [
  "created",
  "pending",
  "approved",
  "canceled",
  "expired",
] as const;
export type OfferingStage = (typeof OFFERING_STAGES)[number];

/** How many records currently sit in one lifecycle stage. */
export interface StageCount {
  /** Stage key (one of the lifecycle stage unions above). */
  stage: string;
  count: number;
}

/** Distinct active users seen on a single page or tab. */
export interface PageTraffic {
  /** Page or tab label. */
  page: string;
  /** Distinct users seen. */
  users: number;
}

/** Landing-page bounce: sessions that arrived but never navigated onward. */
export interface BounceRate {
  /** Bounced sessions over total landing sessions, in the range 0..1. */
  rate: number;
  bounced: number;
  sessions: number;
}

/** One step of the signup / onboarding flow. */
export interface OnboardingStep {
  /** Human label for the step, e.g. "Email entered". */
  step: string;
  /** Users who reached this step. */
  entered: number;
  /** Users who advanced past it to the next step. */
  completed: number;
}

/** Per-day platform activity. */
export interface DailyMetric {
  /** Day as `YYYY-MM-DD`. */
  date: string;
  /** Investments started that day. */
  investments: number;
  /** New signups that day. */
  signups: number;
  /** Capital raised that day, in USD. */
  amountRaised: number;
}

/** The full KPI dashboard payload. */
export interface KpiDashboard {
  summary: KpiSummary;
  investmentLifecycle: StageCount[];
  offeringLifecycle: StageCount[];
  pageTraffic: PageTraffic[];
  bounce: BounceRate;
  onboarding: OnboardingStep[];
  daily: DailyMetric[];
}
