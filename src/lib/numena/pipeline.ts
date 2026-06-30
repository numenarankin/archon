/**
 * Pipeline types shared by the board UI. Pure (no server imports) so client
 * components can import it. The data fetch lives in `./pipeline-data` and the
 * mutations in `./deal-actions`.
 */

export type BusinessUnitKey = "numena" | "wildcat";

/** A single deal card on the pipeline board. */
export interface Deal {
  id: string;
  /** Short deal name / headline. */
  name: string;
  /** Account / company the deal is with (display). */
  company: string;
  /** Deal size in USD. */
  value: number;
  /** The stage column this deal sits in (a crm_pipeline_stages id). */
  stageId: string;
  /** Sales rep who owns the deal (display label). */
  owner?: string;
  /** Expected (or actual) close date, ISO `YYYY-MM-DD`. */
  closeDate?: string;
  /** Likelihood of closing, 0–100. */
  probability?: number;
  /** Free-form note shown in the card preview. */
  note?: string;
}

/** A pipeline stage = a board column (from crm_pipeline_stages). */
export interface PipelineStage {
  id: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
}

/** Selectable deal owners (sales reps). */
export const DEAL_OWNERS = [
  "Grant Holloway",
  "Renee Salazar",
  "Wesley Park",
  "Bianca Reyes",
];

/** Sentinel shown in the owner dropdown for an unassigned deal. */
export const UNOWNED = "Unassigned";
