/**
 * Mock data + types for the Wildcat Sales desk. This is a prototype: everything
 * lives in memory and is generated deterministically (no Date/random) so the
 * server and client render the same lineup. No persistence, no real dialing.
 */

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri";

export const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
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

// Deterministic seed pools. Index math (not random) keeps SSR + client identical.
const FIRST = [
  "James", "Maria", "Robert", "Dale", "Susan", "Hank", "Carla", "Wes",
  "Priya", "Gus", "Lena", "Marcus", "Joan", "Ray", "Tina", "Cole",
  "Brenda", "Owen", "Faye", "Dwight",
];
const LAST = [
  "Hollis", "Vance", "Castillo", "Okafor", "Pratt", "Nunez", "Boone",
  "Reyes", "Sutton", "Mara", "Goss", "Fenn", "Albright", "Cho", "Drake",
  "Ibarra", "Welch", "Kemp", "Salas", "Ott",
];
const COMPANIES = [
  "Permian Crest Energy", "Bar-S Operating", "Llano Ridge Resources",
  "Coyote Draw Oil & Gas", "Sandhill Petroleum", "Red Bluff Operating",
  "Mesa Verde Minerals", "Pecos Star Energy", "Caprock Production",
  "Two Rivers Operating", "Lobo Canyon Resources", "Wolfcamp Holdings",
  "Yucca Flats Energy", "Big Lake Petroleum", "Dagger Draw Oil",
  "Salt Fork Operating", "Anvil Rock Resources", "Comanche Trail Energy",
  "Espada Production", "High Lonesome Oil",
];
const TITLES = [
  "Owner / Operator", "Operations Manager", "Land Manager",
  "Production Foreman", "VP of Operations", "Regulatory Analyst",
  "Drilling Superintendent", "CFO", "Field Supervisor", "Partner",
];
const CITIES = [
  "Midland, TX", "Odessa, TX", "Big Spring, TX", "Hobbs, NM",
  "Pecos, TX", "Andrews, TX", "Carlsbad, NM", "Snyder, TX",
  "Fort Stockton, TX", "Artesia, NM",
];
const SOURCES = [
  "RRC operator list", "Form D filing", "Referral — BD desk",
  "Allowable schedule (WLF100)", "Trade show — Permian Basin",
];
const BEST_TIME = ["Before 9am", "Mid-morning", "After lunch", "Late afternoon"];

// How many calls land on each day — deliberately uneven so the queue looks real.
const PER_DAY: Record<WeekdayKey, number> = {
  mon: 14,
  tue: 11,
  wed: 13,
  thu: 9,
  fri: 12,
};

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// Outcomes that mean "already dialed this week" — used to seed some queue cards
// as called so the strike-through is visible without working the desk first.
const CALLED_POOL: CallStatus[] = [
  "no_answer",
  "callback",
  "meeting",
  "not_interested",
];

/** A prospect counts as called this week once it carries a non-"new" status. */
export function isCalled(prospect: Prospect): boolean {
  return prospect.status !== "new";
}

function buildProspect(day: WeekdayKey, i: number, n: number): Prospect {
  const first = pick(FIRST, n);
  const last = pick(LAST, n * 3 + 1);
  const name = `${first} ${last}`;
  const company = pick(COMPANIES, n * 2 + 1);
  const title = pick(TITLES, n + day.length);
  const location = pick(CITIES, n * 5 + 2);
  const wells = 6 + ((n * 7) % 40);
  const phone = `(432) 555-${String(100 + ((n * 37) % 900)).padStart(3, "0")}${
    (n % 9) + 1
  }`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}@${company
    .toLowerCase()
    .replace(/[^a-z]+/g, "")
    .slice(0, 12)}.com`;
  const source = pick(SOURCES, n + 1);

  return {
    id: `wp-${day}-${i}`,
    name,
    title,
    company,
    phone,
    email,
    location,
    // Seed roughly every fourth prospect as already dialed this week.
    status: i % 4 === 0 ? pick(CALLED_POOL, n) : "new",
    day,
    hook: `${wells} wells · ${pick(BEST_TIME, n)}`,
    highlights: [
      `Operates ${wells} producing wells in the ${location.split(",")[0]} area.`,
      `Surfaced via ${source.toLowerCase()}.`,
      `Best reached ${pick(BEST_TIME, n).toLowerCase()}.`,
    ],
    dossier: [
      { label: "Company", value: company },
      { label: "Title", value: title },
      { label: "Location", value: location },
      { label: "Wells operated", value: String(wells) },
      { label: "Source", value: source },
      { label: "Last contact", value: i % 4 === 0 ? "Voicemail, 11 days ago" : "None" },
      { label: "Best time", value: pick(BEST_TIME, n) },
    ],
    openingScript:
      `Hi ${first}, this is Casey over at Wildcat — I know I'm catching you cold, ` +
      `so I'll be quick. We help ${location.split(",")[0]} operators like ${company} ` +
      `keep their RRC allowable and proration filings clean without the back-and-forth. ` +
      `Quick question while I've got you — are you the one who handles production ` +
      `reporting on your wells, or is that someone on your team?`,
    objections: DEFAULT_OBJECTIONS,
    transcript: [
      { speaker: "rep", text: `Hi, is this ${first}?` },
      { speaker: "prospect", text: "Speaking — who's this?" },
      {
        speaker: "rep",
        text: "It's Casey with Wildcat. Caught you at a bad time?",
      },
      { speaker: "prospect", text: "I've got a minute. What's this about?" },
    ],
  };
}

// Generate the full week once at module load. Exported as the seed/fallback the
// Supabase data layer uses before the desk is populated (see sales-data.ts).
export const SEED_PROSPECTS: Prospect[] = WEEKDAYS.flatMap((d) => {
  const count = PER_DAY[d.key];
  return Array.from({ length: count }, (_, i) =>
    buildProspect(d.key, i, i + d.key.charCodeAt(0))
  );
});

/** Map the 1..5 queue_day column to a weekday key (and back). */
export const DAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];
export function dayKeyFromNum(n: number | null | undefined): WeekdayKey {
  return DAY_KEYS[(n ?? 1) - 1] ?? "mon";
}
export function numFromDayKey(key: WeekdayKey): number {
  const i = DAY_KEYS.indexOf(key);
  return i === -1 ? 1 : i + 1;
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

// Outcomes a completed call can carry (everything except the queue-only "new").
const HISTORY_STATUSES: CallStatus[] = [
  "no_answer",
  "callback",
  "meeting",
  "not_interested",
  "dnc",
];

const HISTORY_NOTES = [
  "Reached the gatekeeper, asked for a callback after 2pm. Sounded receptive.",
  "Left a voicemail — referenced the allowable filing pain point.",
  "Quick chat. Already runs a competitor but open to a side-by-side. Sending the one-pager.",
  "Not the decision maker; pointed me to the ops manager. Got the name.",
  "Wants nothing to do with vendors right now. Marked do-not-call per his request.",
  "Booked a 30-min demo for next week. Excited about the proration schedule automation.",
  "Phone tag again. Best window is early morning per the notes.",
  "Talked numbers — well count makes it an easy ROI. Following up with the email template.",
];

const HISTORY_TIMES = ["8:42 AM", "9:15 AM", "10:24 AM", "11:38 AM", "1:05 PM", "2:50 PM", "3:33 PM", "4:18 PM"];
const HISTORY_DURATIONS = ["0m 38s", "1m 12s", "2m 47s", "4m 12s", "5m 53s", "7m 21s", "0m 12s", "3m 04s"];

// Build ~3 weeks of history (June 2026) from the prospect pool, deterministically.
// Exported as the seed/fallback used by the Supabase data layer (sales-data.ts).
export const SEED_CALL_HISTORY: CallRecord[] = SEED_PROSPECTS.slice(0, 36)
  .map((p, i) => {
    // Spread across business days 2026-06-02 .. 2026-06-24, newest assigned last.
    const dayOfMonth = 2 + ((i * 13) % 23);
    return {
      id: `call-${p.id}`,
      prospect: { ...p, status: pick(HISTORY_STATUSES, i) },
      date: `2026-06-${String(dayOfMonth).padStart(2, "0")}`,
      time: pick(HISTORY_TIMES, i * 3),
      duration: pick(HISTORY_DURATIONS, i * 5),
      notes: pick(HISTORY_NOTES, i * 2),
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

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
