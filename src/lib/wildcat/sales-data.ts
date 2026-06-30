import "server-only";

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_SALES_CONFIG,
  dayKeyFromNum,
  formatDuration,
  type CallRecord,
  type CallStatus,
  type DossierField,
  type Prospect,
  type SalesConfig,
  type TranscriptLine,
} from "@/lib/wildcat/sales";

type Sb = Awaited<ReturnType<typeof getSupabaseServer>>;

/** Which business unit's desk we're reading (its prospects, calls). */
export type BusinessUnitKey = "wildcat" | "numena";

/** Resolve a business unit's id from its key (RLS-scoped to the workspace). */
async function businessUnitId(sb: Sb, key: BusinessUnitKey): Promise<string | null> {
  const { data } = await sb
    .from("business_units")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

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

/**
 * A business unit's queue, read straight from the database (Unscheduled first,
 * then by day + position). Empty until prospects are added — no mock seed.
 */
export async function getQueue(buKey: BusinessUnitKey): Promise<Prospect[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = await getSupabaseServer();
    const buId = await businessUnitId(sb, buKey);
    if (!buId) return [];
    const rows = await selectProspects(sb, buId);
    return rows.map(mapProspect);
  } catch (error) {
    console.error("[sales] getQueue failed:", error);
    return [];
  }
}

async function selectProspects(sb: Sb, buId: string): Promise<ProspectRow[]> {
  const { data, error } = await sb
    .from("sales_prospects")
    .select(PROSPECT_COLS)
    .eq("business_unit_id", buId)
    .order("queue_day", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`selectProspects: ${error.message}`);
  return (data ?? []) as ProspectRow[];
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

/** Logged calls for a business unit, newest first. Empty until calls are made. */
export async function getCallHistory(buKey: BusinessUnitKey): Promise<CallRecord[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = await getSupabaseServer();
    const buId = await businessUnitId(sb, buKey);
    if (!buId) return [];
    const { data, error } = await sb
      .from("sales_calls")
      .select(
        "id, status, started_at, duration_seconds, notes, dossier_snapshot, " +
          "sales_prospects!inner ( name, title, company, phone, email, location, queue_day, hook, highlights, dossier, business_unit_id )"
      )
      .eq("sales_prospects.business_unit_id", buId)
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`getCallHistory: ${error.message}`);
    const rows = (data ?? []) as unknown as CallRow[];
    const linesByCall = await loadTranscriptLines(sb, rows.map((r) => r.id));
    return rows.map((r) => mapCallRecord(r, linesByCall.get(r.id) ?? []));
  } catch (error) {
    console.error("[sales] getCallHistory failed:", error);
    return [];
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
