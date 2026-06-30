"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  createGoogleCalendarEvent,
  hasGoogleCalendar,
} from "@/lib/calendar/google-calendar";
import { sendMessage } from "@/lib/email/actions";
import { areaCodeOf, pickOutboundNumber } from "@/lib/wildcat/outbound";
import { encodeClientState } from "@/lib/wildcat/telephony/telnyx";
import {
  numFromDayKey,
  type CallStatus,
  type FollowUpType,
  type SalesConfig,
  type TranscriptLine,
  type WeekdayKey,
} from "@/lib/wildcat/sales";

/**
 * The desk can run on the in-memory seed (before the migration is applied or
 * the workspace is seeded), where ids are slugs like "wp-mon-0" rather than
 * uuids. Persisting those would fail the uuid columns, so writes no-op for
 * non-uuid ids and the UI stays optimistic until real rows exist.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

function revalidate(): void {
  revalidatePath("/wildcat/sales");
  revalidatePath("/numena/sales");
}

export interface QueueOrderItem {
  id: string;
  day: WeekdayKey;
  sortOrder: number;
}

/** Persist queue day + position after a drag (Queue board or Desk lineup). */
export async function saveQueueOrder(items: QueueOrderItem[]): Promise<void> {
  const persistable = items.filter((it) => isUuid(it.id));
  if (persistable.length === 0) return;
  const sb = await getSupabaseServer();
  const results = await Promise.all(
    persistable.map((it) =>
      sb
        .from("sales_prospects")
        .update({ queue_day: numFromDayKey(it.day), sort_order: it.sortOrder })
        .eq("id", it.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`saveQueueOrder: ${failed.error.message}`);
  revalidate();
}

/** Update a prospect's status (and stamp last_called_at once it's been dialed). */
export async function updateProspectStatus(
  id: string,
  status: CallStatus
): Promise<void> {
  if (!isUuid(id)) return;
  const sb = await getSupabaseServer();
  const patch: { status: CallStatus; last_called_at?: string } = { status };
  if (status !== "new") patch.last_called_at = new Date().toISOString();
  const { error } = await sb.from("sales_prospects").update(patch).eq("id", id);
  if (error) throw new Error(`updateProspectStatus: ${error.message}`);
  revalidate();
}

export interface LogCallInput {
  prospectId: string;
  status: CallStatus;
  notes: string;
  durationSeconds: number;
  transcript: TranscriptLine[];
}

/**
 * Record a completed call: a `sales_calls` row plus transcript lines, and stamp
 * the prospect as called. Returns the new call id (null in seed mode).
 */
export async function logCall(input: LogCallInput): Promise<{ callId: string } | null> {
  if (!isUuid(input.prospectId)) return null;
  const sb = await getSupabaseServer();

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("sales_calls")
    .insert({
      prospect_id: input.prospectId,
      status: input.status,
      notes: input.notes || null,
      duration_seconds: Math.max(0, Math.floor(input.durationSeconds)),
      ended_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(`logCall: ${error.message}`);
  const callId = (data as { id: string }).id;

  if (input.transcript.length > 0) {
    const rows = input.transcript.map((l, i) => ({
      call_id: callId,
      speaker: l.speaker,
      text: l.text,
      seq: i,
    }));
    const { error: linesErr } = await sb.from("sales_call_lines").insert(rows);
    if (linesErr) throw new Error(`logCall lines: ${linesErr.message}`);
  }

  const { error: statusErr } = await sb
    .from("sales_prospects")
    .update({ status: input.status, last_called_at: now })
    .eq("id", input.prospectId);
  if (statusErr) throw new Error(`logCall status: ${statusErr.message}`);

  revalidate();
  return { callId };
}

export interface StartCallResult {
  ok: boolean;
  callId?: string;
  callerNumber?: string;
  destinationNumber?: string;
  clientState?: string;
  error?: string;
}

/**
 * Begin a call: select a local-presence outbound number, create the
 * `sales_calls` row, and return what the browser dialer needs for `newCall`
 * (caller id, destination, and the base64 client_state that ties the Telnyx leg
 * back to this call row on webhooks).
 */
export async function startCall(input: {
  prospectId: string;
  phone: string;
}): Promise<StartCallResult> {
  try {
    const sb = await getSupabaseServer();
    const { data: nums, error: numErr } = await sb
      .from("sales_outbound_numbers")
      .select("e164, area_code, region, active");
    if (numErr) throw new Error(numErr.message);
    const numbers = (nums ?? []).map(
      (n: { e164: string; area_code: string; region: string | null; active: boolean }) => ({
        e164: n.e164,
        areaCode: n.area_code,
        region: n.region ?? undefined,
        active: n.active,
      })
    );
    const pick = pickOutboundNumber(areaCodeOf(input.phone), numbers);
    if (!pick) return { ok: false, error: "No outbound numbers configured." };

    const { data, error } = await sb
      .from("sales_calls")
      .insert({
        prospect_id: isUuid(input.prospectId) ? input.prospectId : null,
        outbound_number: pick.e164,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const callId = (data as { id: string }).id;

    revalidate();
    return {
      ok: true,
      callId,
      callerNumber: pick.e164,
      destinationNumber: input.phone,
      clientState: encodeClientState({ callId }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not start the call.",
    };
  }
}

/** Change the logged outcome on a past call (History tab). */
export async function updateCallStatus(
  callId: string,
  status: CallStatus
): Promise<void> {
  if (!isUuid(callId)) return;
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("sales_calls")
    .update({ status })
    .eq("id", callId);
  if (error) throw new Error(`updateCallStatus: ${error.message}`);
  revalidate();
}

// --- Follow-ups ------------------------------------------------------------

/** Add minutes to an `HH:MM` time, wrapping within the day. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

export interface ScheduleFollowUpInput {
  prospectId: string;
  type: FollowUpType;
  toEmail: string;
  toName: string;
  /** calendar_invite */
  date?: string;
  time?: string;
  durationMinutes?: number;
  addMeet?: boolean;
  title?: string;
  /** scheduling_link */
  schedulingUrl?: string;
  /** custom_email / message body + subject */
  subject?: string;
  body?: string;
}

export interface ScheduleFollowUpResult {
  ok: boolean;
  message: string;
  meetLink?: string | null;
}

/**
 * Fire a follow-up action: book a Google Calendar event (optionally with Meet)
 * or email a scheduling link / custom message, then record it in
 * sales_follow_ups. Degrades gracefully when Google/email are not configured.
 */
export async function scheduleFollowUp(
  input: ScheduleFollowUpInput
): Promise<ScheduleFollowUpResult> {
  let meetLink: string | null = null;
  let calendarEventId: string | null = null;
  let scheduledFor: string | null = null;
  let message: string;

  if (input.type === "calendar_invite") {
    const date = input.date ?? "";
    const time = input.time ?? "10:00";
    const duration = input.durationMinutes ?? 30;
    scheduledFor = date ? `${date}T${time}:00` : null;

    if (await hasGoogleCalendar()) {
      try {
        const event = await createGoogleCalendarEvent({
          title: input.title ?? `Wildcat intro — ${input.toName}`,
          date,
          allDay: false,
          start: time,
          end: addMinutes(time, duration),
          location: "",
          people: [],
          description: input.body ?? "",
          attendeeEmails: [input.toEmail],
          addMeet: Boolean(input.addMeet),
        });
        meetLink = event.hangoutLink;
        calendarEventId = event.id;
        message = `Calendar invite sent to ${input.toEmail}.${
          meetLink ? ` Meet: ${meetLink}` : ""
        }`;
      } catch (error) {
        return {
          ok: false,
          message: `Couldn't reach Google Calendar: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        };
      }
    } else {
      message = `Calendar invite scheduled for ${date} ${time} (connect Google Calendar to send it).`;
    }
  } else if (input.type === "scheduling_link") {
    const link = input.schedulingUrl ?? "";
    const res = await sendMessage({
      to: input.toEmail,
      subject: input.subject || "Let's find a time",
      body: `${input.body ?? ""}\n\n${link}`.trim(),
    });
    message = res.delivered
      ? `Scheduling link emailed to ${input.toEmail}.`
      : `Scheduling link queued for ${input.toEmail}.`;
  } else {
    const res = await sendMessage({
      to: input.toEmail,
      subject: input.subject || "Following up",
      body: input.body ?? "",
    });
    message = res.delivered
      ? `Email sent to ${input.toEmail}.`
      : `Email queued for ${input.toEmail}.`;
  }

  if (isUuid(input.prospectId)) {
    try {
      const sb = await getSupabaseServer();
      await sb.from("sales_follow_ups").insert({
        prospect_id: input.prospectId,
        type: input.type,
        scheduled_for: scheduledFor,
        duration_minutes: input.durationMinutes ?? null,
        meet_link: meetLink,
        calendar_event_id: calendarEventId,
        email_subject: input.subject ?? null,
        email_body: input.body ?? null,
        status: "sent",
      });
      revalidate();
    } catch (error) {
      console.error("scheduleFollowUp persist failed", error);
    }
  }

  return { ok: true, message, meetLink };
}

/** Persist the whole desk config (script + objections + follow-up options). */
export async function saveSalesConfig(config: SalesConfig): Promise<void> {
  const sb = await getSupabaseServer();
  const { data: workspaceId, error: wsErr } = await sb.rpc(
    "app_default_workspace_id"
  );
  if (wsErr) throw new Error(`saveSalesConfig (workspace): ${wsErr.message}`);
  if (!workspaceId) return;
  const { error } = await sb
    .from("sales_config")
    .upsert(
      { workspace_id: workspaceId, config, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );
  if (error) throw new Error(`saveSalesConfig: ${error.message}`);
  revalidate();
}
