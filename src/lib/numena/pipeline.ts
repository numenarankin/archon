/**
 * Numena sales pipeline — frontend mock.
 *
 * Mirrors the Tasks kanban model (statuses → columns, items → cards) but for
 * sales deals. This is placeholder data only; there is no backend table yet, so
 * everything lives in memory and resets on reload.
 */

/** The pipeline stages, left to right on the board. */
export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

/** A single deal card on the pipeline board. */
export interface Deal {
  id: string;
  /** Short deal name / headline. */
  name: string;
  company: string;
  /** Deal size in USD. */
  value: number;
  stage: DealStage;
  /** Sales rep who owns the deal. */
  owner?: string;
  /** Expected (or actual) close date, ISO `YYYY-MM-DD`. */
  closeDate?: string;
  /** Likelihood of closing, 0–100. */
  probability?: number;
  /** Free-form note shown in the card preview. */
  note?: string;
}

export interface PipelineStageDef {
  stage: DealStage;
  label: string;
}

/** Column definitions, left-to-right. */
export const PIPELINE_STAGES: PipelineStageDef[] = [
  { stage: "lead", label: "Lead" },
  { stage: "qualified", label: "Qualified" },
  { stage: "proposal", label: "Proposal" },
  { stage: "negotiation", label: "Negotiation" },
  { stage: "won", label: "Closed Won" },
  { stage: "lost", label: "Closed Lost" },
];

/** Selectable deal owners (sales reps). */
export const DEAL_OWNERS = [
  "Grant Holloway",
  "Renee Salazar",
  "Wesley Park",
  "Bianca Reyes",
];

/** Sentinel shown in the owner dropdown for an unassigned deal. */
export const UNOWNED = "Unassigned";

const DEALS: Deal[] = [
  {
    id: "d-1",
    name: "Reg D data feed — annual",
    company: "Permian Crest Capital",
    value: 120000,
    stage: "lead",
    owner: "Grant Holloway",
    closeDate: "2026-08-15",
    probability: 20,
    note: "Inbound from the prospecting list. Wants a demo of the 506(c) feed.",
  },
  {
    id: "d-2",
    name: "Pilot — issuer enrichment",
    company: "Sabine Family Office",
    value: 45000,
    stage: "lead",
    owner: "Renee Salazar",
    closeDate: "2026-07-30",
    probability: 15,
  },
  {
    id: "d-3",
    name: "Platform seats (10)",
    company: "Redbed Mineral Partners",
    value: 88000,
    stage: "qualified",
    owner: "Wesley Park",
    closeDate: "2026-07-22",
    probability: 40,
    note: "Budget confirmed for Q3. Needs security review.",
  },
  {
    id: "d-4",
    name: "Form D alerts add-on",
    company: "Gulf Meridian Advisors",
    value: 32000,
    stage: "qualified",
    owner: "Grant Holloway",
    closeDate: "2026-08-05",
    probability: 45,
  },
  {
    id: "d-5",
    name: "Enterprise rollout",
    company: "Anadarko Bridge Ventures",
    value: 210000,
    stage: "proposal",
    owner: "Bianca Reyes",
    closeDate: "2026-09-01",
    probability: 55,
    note: "Proposal sent 6/18. Multi-team deployment across two funds.",
  },
  {
    id: "d-6",
    name: "API access tier",
    company: "Llano Estacado Holdings",
    value: 64000,
    stage: "proposal",
    owner: "Renee Salazar",
    closeDate: "2026-08-20",
    probability: 50,
  },
  {
    id: "d-7",
    name: "Annual contract renewal",
    company: "Tidewater Securities",
    value: 150000,
    stage: "negotiation",
    owner: "Wesley Park",
    closeDate: "2026-07-10",
    probability: 75,
    note: "Redlines back from legal. Close on price.",
  },
  {
    id: "d-8",
    name: "Custom dataset build",
    company: "Crossroads Capital Group",
    value: 96000,
    stage: "negotiation",
    owner: "Grant Holloway",
    closeDate: "2026-07-18",
    probability: 70,
  },
  {
    id: "d-9",
    name: "Prospecting + KPIs bundle",
    company: "Frontier Energy Partners",
    value: 180000,
    stage: "won",
    owner: "Bianca Reyes",
    closeDate: "2026-06-12",
    probability: 100,
    note: "Signed. Kickoff scheduled for next week.",
  },
  {
    id: "d-10",
    name: "Starter plan",
    company: "Summit Resource Brokers",
    value: 24000,
    stage: "won",
    owner: "Renee Salazar",
    closeDate: "2026-06-01",
    probability: 100,
  },
  {
    id: "d-11",
    name: "Data feed — annual",
    company: "Lone Star Advisory",
    value: 72000,
    stage: "lost",
    owner: "Wesley Park",
    closeDate: "2026-05-28",
    probability: 0,
    note: "Went with an in-house build. Revisit in 2027.",
  },
];

export async function getDeals(): Promise<Deal[]> {
  return DEALS;
}
