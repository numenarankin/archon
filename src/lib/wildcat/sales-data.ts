import "server-only";

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_SALES_CONFIG,
  SEED_CALL_HISTORY,
  SEED_PROSPECTS,
  dayKeyFromNum,
  formatDuration,
  numFromDayKey,
  type CallRecord,
  type CallStatus,
  type DossierField,
  type Prospect,
  type SalesConfig,
  type TranscriptLine,
} from "@/lib/wildcat/sales";

type Sb = Awaited<ReturnType<typeof getSupabaseServer>>;

const PROSPECT_COLS =
  "id, name, title, company, phone, email, location, status, queue_day, sort_order, hook, highlights, dossier, last_called_at";

interface ProspectRow {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  phone: string;
  email: string | null;
  location: string | null;
  status: CallStatus;
  queue_day: number | null;
  hook: string | null;
  highlights: string[] | null;
  dossier: DossierField[] | null;
}

/**
 * Map a DB prospect to the domain type. `openingScript`/`objections` are left
 * empty because the Desk renders those from the workspace SalesConfig, not the
 * prospect; `transcript` is empty until a call is logged.
 */
function mapProspect(r: ProspectRow): Prospect {
  return {
    id: r.id,
    name: r.name,
    title: r.title ?? "",
    company: r.company ?? "",
    phone: r.phone,
    email: r.email ?? "",
    location: r.location ?? "",
    status: r.status,
    day: dayKeyFromNum(r.queue_day),
    hook: r.hook ?? r.highlights?.[0] ?? "",
    highlights: r.highlights ?? [],
    dossier: r.dossier ?? [],
    openingScript: "",
    objections: [],
    transcript: [],
  };
}

/** Shape we insert when seeding an empty desk from the in-memory prospects. */
function prospectToRow(p: Prospect) {
  return {
    name: p.name,
    title: p.title,
    company: p.company,
    phone: p.phone,
    email: p.email,
    location: p.location,
    area_code: areaCodeOf(p.phone),
    status: p.status,
    queue_day: numFromDayKey(p.day),
    sort_order: 0,
    hook: p.hook,
    highlights: p.highlights,
    dossier: p.dossier,
  };
}

/** Best-effort NANP area code from a phone string. */
export function areaCodeOf(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return national.length >= 10 ? national.slice(0, 3) : null;
}

/**
 * The day's queue, ordered. Falls back to the in-memory seed when Supabase is
 * unconfigured or unreachable. When the table exists but is empty, it seeds the
 * desk from the in-memory prospects once so the workspace starts populated.
 */
export async function getQueue(): Promise<Prospect[]> {
  if (!hasSupabase()) return SEED_PROSPECTS;
  try {
    const sb = await getSupabaseServer();
    let rows = await selectProspects(sb);
    if (rows.length === 0) {
      await seedProspects(sb);
      rows = await selectProspects(sb);
    }
    return rows.length ? rows.map(mapProspect) : SEED_PROSPECTS;
  } catch (error) {
    console.error("[sales] getQueue fell back to seed:", error);
    return SEED_PROSPECTS;
  }
}

async function selectProspects(sb: Sb): Promise<ProspectRow[]> {
  const { data, error } = await sb
    .from("sales_prospects")
    .select(PROSPECT_COLS)
    .order("queue_day", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`selectProspects: ${error.message}`);
  return (data ?? []) as ProspectRow[];
}

async function seedProspects(sb: Sb): Promise<void> {
  const { error } = await sb
    .from("sales_prospects")
    .insert(SEED_PROSPECTS.map(prospectToRow));
  if (error) throw new Error(`seedProspects: ${error.message}`);
}

// --- Call history ----------------------------------------------------------

interface CallRow {
  id: string;
  status: CallStatus | null;
  started_at: string;
  duration_seconds: number | null;
  notes: string | null;
  dossier_snapshot: DossierField[] | null;
  sales_prospects: {
    name: string | null;
    title: string | null;
    company: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    queue_day: number | null;
    hook: string | null;
    highlights: string[] | null;
    dossier: DossierField[] | null;
  } | null;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function mapCallRecord(r: CallRow, lines: TranscriptLine[]): CallRecord {
  const p = r.sales_prospects;
  const status: CallStatus = r.status ?? "no_answer";
  const started = new Date(r.started_at);
  const prospect: Prospect = {
    id: r.id,
    name: p?.name ?? "Unknown",
    title: p?.title ?? "",
    company: p?.company ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    location: p?.location ?? "",
    status,
    day: dayKeyFromNum(p?.queue_day),
    hook: p?.hook ?? "",
    highlights: p?.highlights ?? [],
    dossier: r.dossier_snapshot ?? p?.dossier ?? [],
    openingScript: "",
    objections: [],
    transcript: lines,
  };
  return {
    id: r.id,
    prospect,
    date: r.started_at.slice(0, 10),
    time: timeFmt.format(started),
    duration: formatDuration(r.duration_seconds),
    notes: r.notes ?? "",
  };
}

/** Logged calls, newest first. Falls back to the seed when Supabase is down. */
export async function getCallHistory(): Promise<CallRecord[]> {
  if (!hasSupabase()) return SEED_CALL_HISTORY;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("sales_calls")
      .select(
        "id, status, started_at, duration_seconds, notes, dossier_snapshot, " +
          "sales_prospects ( name, title, company, phone, email, location, queue_day, hook, highlights, dossier )"
      )
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`getCallHistory: ${error.message}`);
    const rows = (data ?? []) as unknown as CallRow[];
    const linesByCall = await loadTranscriptLines(sb, rows.map((r) => r.id));
    return rows.map((r) => mapCallRecord(r, linesByCall.get(r.id) ?? []));
  } catch (error) {
    console.error("[sales] getCallHistory fell back to seed:", error);
    return SEED_CALL_HISTORY;
  }
}

async function loadTranscriptLines(
  sb: Sb,
  callIds: string[]
): Promise<Map<string, TranscriptLine[]>> {
  const byCall = new Map<string, TranscriptLine[]>();
  if (callIds.length === 0) return byCall;
  const { data, error } = await sb
    .from("sales_call_lines")
    .select("call_id, speaker, text, seq")
    .in("call_id", callIds)
    .order("seq", { ascending: true });
  if (error || !data) return byCall;
  for (const row of data as {
    call_id: string;
    speaker: "rep" | "prospect";
    text: string;
  }[]) {
    const list = byCall.get(row.call_id) ?? [];
    list.push({ speaker: row.speaker, text: row.text });
    byCall.set(row.call_id, list);
  }
  return byCall;
}

// --- Config ----------------------------------------------------------------

/** The workspace's desk config, or the in-memory defaults when none is saved. */
export async function getSalesConfig(): Promise<SalesConfig> {
  if (!hasSupabase()) return DEFAULT_SALES_CONFIG;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("sales_config")
      .select("config")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getSalesConfig: ${error.message}`);
    const config = (data as { config: SalesConfig } | null)?.config;
    // An empty {} row (or no row) means "never configured" → defaults.
    if (!config || !config.openingScript) return DEFAULT_SALES_CONFIG;
    return config;
  } catch (error) {
    console.error("[sales] getSalesConfig fell back to defaults:", error);
    return DEFAULT_SALES_CONFIG;
  }
}
