/**
 * Mock data + types for the Wildcat Sales desk. This is a prototype: everything
 * lives in memory and is generated deterministically (no Date/random) so the
 * server and client render the same lineup. No persistence, no real dialing.
 */

// Desk columns. "unscheduled" is the inbox for prospects added (e.g. from the
// prospecting page) that haven't been dragged onto a calling day yet.
export type WeekdayKey = "unscheduled" | "tue" | "wed" | "thu";

export const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: "unscheduled", label: "Unscheduled", short: "Unscheduled" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
];

export type CallStatus =
  | "new"
  | "no_answer"
  | "callback"
  | "meeting"
  | "not_interested"
  | "dnc";

export const STATUSES: { key: CallStatus; label: string; dot: string }[] = [
  { key: "new", label: "New", dot: "bg-muted-foreground/40" },
  { key: "no_answer", label: "No answer", dot: "bg-amber-500" },
  { key: "callback", label: "Callback", dot: "bg-blue-500" },
  { key: "meeting", label: "Meeting set", dot: "bg-emerald-500" },
  { key: "not_interested", label: "Not interested", dot: "bg-rose-500" },
  { key: "dnc", label: "Do not call", dot: "bg-foreground/60" },
];

export function statusMeta(status: CallStatus) {
  return STATUSES.find((s) => s.key === status) ?? STATUSES[0];
}

/** Drag-and-drop item types, shared across queue + lineup. */
export const QUEUE_DND_TYPE = "queue-prospect";
export const LINEUP_DND_TYPE = "lineup-prospect";

export interface DossierField {
  label: string;
  value: string;
}

/** A common objection and the suggested rebuttal, shown as an expandable card. */
export interface Objection {
  id: string;
  trigger: string;
  response: string;
}

export interface TranscriptLine {
  speaker: "rep" | "prospect";
  text: string;
}

export interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  location: string;
  status: CallStatus;
  /** Which day of the working week this call is queued for. */
  day: WeekdayKey;
  /** One-line hook shown on the compact queue card. */
  hook: string;
  /** Bullet summary at the top of the call card. */
  highlights: string[];
  dossier: DossierField[];
  openingScript: string;
  objections: Objection[];
  transcript: TranscriptLine[];
}

// A shared objection-handling library — the same quick-reference cards ride
// along with every prospect on the desk. Editable from the Config tab.
export const DEFAULT_OBJECTIONS: Objection[] = [
  {
    id: "o-busy",
    trigger: "I'm in the middle of something",
    response:
      "Totally fair — I'll be quick. Thirty seconds and if it's not useful I'll let you go. Are you the one who handles allowable filings for the wells?",
  },
  {
    id: "o-email",
    trigger: "Just send me an email",
    response:
      "Happy to. So I send the right thing and not noise — are you looking to cut filing time, or is reporting accuracy the bigger headache right now?",
  },
  {
    id: "o-provider",
    trigger: "We already have someone for that",
    response:
      "Makes sense, most operators your size do. A lot of them still run us alongside for the RRC proration schedule — what are you using for that today?",
  },
  {
    id: "o-notinterested",
    trigger: "Not interested",
    response:
      "Understood — I won't push. Before I go, was it the timing or just not a fit at all? That tells me whether to even follow up next quarter.",
  },
  {
    id: "o-price",
    trigger: "What does it cost",
    response:
      "Depends on well count, so I won't guess. Most operators in your range land where it pays for itself on the first filing cycle. Want the quick math on your count?",
  },
  {
    id: "o-decisionmaker",
    trigger: "I'm not the right person",
    response:
      "No problem — who runs production reporting on your side? I'll mention we spoke so it's not a cold hand-off.",
  },
];

/** A prospect counts as called this week once it carries a non-"new" status. */
export function isCalled(prospect: Prospect): boolean {
  return prospect.status !== "new";
}

/**
 * Map the persisted `queue_day` to a desk column and back. NULL (no day) is the
 * Unscheduled inbox; 2/3/4 are Tue/Wed/Thu. (1 and 5 are unused now that Monday
 * and Friday columns are gone — they fall back to Unscheduled.)
 */
export function dayKeyFromNum(n: number | null | undefined): WeekdayKey {
  if (n === 2) return "tue";
  if (n === 3) return "wed";
  if (n === 4) return "thu";
  return "unscheduled";
}
export function numFromDayKey(key: WeekdayKey): number | null {
  switch (key) {
    case "tue":
      return 2;
    case "wed":
      return 3;
    case "thu":
      return 4;
    default:
      return null; // unscheduled
  }
}

// ---------------------------------------------------------------------------
// Call history — completed calls, shown in the History tab. Reuses the prospect
// shape for the detail modal and tacks on when/how-long/notes metadata.
// ---------------------------------------------------------------------------

export interface CallRecord {
  id: string;
  prospect: Prospect;
  /** ISO date, YYYY-MM-DD. Fixed strings keep SSR + client in sync. */
  date: string;
  time: string;
  duration: string;
  notes: string;
}

/** Format a call's second count as "Xm Ys" for the History table. */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

// ---------------------------------------------------------------------------
// Desk configuration — what the rep sets up on the Config tab and the desk then
// reads: the opening script template, objection library, and follow-up actions.
// ---------------------------------------------------------------------------

export type FollowUpType = "calendar_invite" | "scheduling_link" | "custom_email";

export interface FollowUpOption {
  id: string;
  type: FollowUpType;
  label: string;
  enabled: boolean;
  /** scheduling_link: the booking URL that gets sent. */
  schedulingUrl?: string;
  /** calendar_invite: default meeting length. */
  duration?: string;
  /** custom_email: default subject + body (supports the script tokens). */
  emailSubject?: string;
  emailBody?: string;
}

export interface SalesConfig {
  /** Opening script template — supports {first}, {company}, {city}, {title}. */
  openingScript: string;
  objections: Objection[];
  followUps: FollowUpOption[];
}

export const SCRIPT_TOKENS = ["{first}", "{company}", "{city}", "{title}"];

const DEFAULT_OPENING_SCRIPT =
  "Hi {first}, this is Casey over at Wildcat — I know I'm catching you cold, " +
  "so I'll be quick. We help {city} operators like {company} keep their RRC " +
  "allowable and proration filings clean without the back-and-forth. Quick " +
  "question while I've got you — are you the one who handles production " +
  "reporting on your wells, or is that someone on your team?";

export const DEFAULT_FOLLOW_UPS: FollowUpOption[] = [
  {
    id: "fu-calendar",
    type: "calendar_invite",
    label: "Send calendar invite",
    enabled: true,
    duration: "30 min",
  },
  {
    id: "fu-link",
    type: "scheduling_link",
    label: "Send scheduling link",
    enabled: true,
    schedulingUrl: "https://cal.com/wildcat/intro",
  },
  {
    id: "fu-email",
    type: "custom_email",
    label: "Send custom email",
    enabled: true,
    emailSubject: "Following up — Wildcat + {company}",
    emailBody:
      "Hi {first},\n\nThanks for the few minutes just now. As promised, here's a " +
      "quick rundown of how we keep RRC allowable and proration filings clean " +
      "for {company}.\n\nWorth a closer look?\n\nCasey",
  },
];

export const DEFAULT_SALES_CONFIG: SalesConfig = {
  openingScript: DEFAULT_OPENING_SCRIPT,
  objections: DEFAULT_OBJECTIONS,
  followUps: DEFAULT_FOLLOW_UPS,
};

/** Fill a script/email template's {tokens} from a prospect. */
export function renderTemplate(template: string, prospect: Prospect): string {
  const first = prospect.name.split(" ")[0];
  const city = prospect.location.split(",")[0];
  return template
    .replaceAll("{first}", first)
    .replaceAll("{company}", prospect.company)
    .replaceAll("{city}", city)
    .replaceAll("{title}", prospect.title);
}
