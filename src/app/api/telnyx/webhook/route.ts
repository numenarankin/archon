import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  decodeClientState,
  encodeClientState,
  startTranscription,
  verifyTelnyxSignature,
  type CallClientState,
  type TranscriptionClientState,
} from "@/lib/wildcat/telephony/telnyx";

/**
 * Telnyx Call Control webhook. Verifies the Ed25519 signature against the raw
 * body, then drives the call lifecycle into Supabase. Runs without a user
 * session, so it uses the service-role client and sets workspace_id explicitly
 * (resolved from the sales_calls row). See plans/telnyx_dialer.md.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");

  if (!verifyTelnyxSignature(raw, signature, timestamp)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: TelnyxEvent;
  try {
    event = JSON.parse(raw) as TelnyxEvent;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const data = event.data ?? event;
  const type = data?.event_type;
  const payload = data?.payload ?? {};

  try {
    if (type) await handleEvent(type, payload);
  } catch (error) {
    // Log but 200 so Telnyx doesn't hammer retries; we have the raw event logged.
    console.error("[telnyx webhook]", type, error);
  }
  return Response.json({ received: true });
}

interface TelnyxPayload {
  call_control_id?: string;
  client_state?: string | null;
  start_time?: string;
  end_time?: string;
  hangup_cause?: string;
  transcription_data?: {
    transcript?: string;
    is_final?: boolean;
    confidence?: number;
  };
}

interface TelnyxEvent {
  data?: { event_type?: string; payload?: TelnyxPayload };
  event_type?: string;
  payload?: TelnyxPayload;
}

async function handleEvent(type: string, payload: TelnyxPayload): Promise<void> {
  const admin = getSupabaseAdmin();

  if (type === "call.initiated") {
    const state = decodeClientState<CallClientState>(payload.client_state);
    if (state?.callId && payload.call_control_id) {
      await admin
        .from("sales_calls")
        .update({ provider_call_id: payload.call_control_id })
        .eq("id", state.callId);
    }
    return;
  }

  if (type === "call.answered") {
    const state = decodeClientState<CallClientState>(payload.client_state);
    const callControlId = payload.call_control_id;
    if (!state?.callId || !callControlId) return;
    // Two transcriptions so each call.transcription is attributable to a track.
    await Promise.all(
      (["inbound", "outbound"] as const).map((track) =>
        startTranscription(
          callControlId,
          track,
          encodeClientState({ callId: state.callId, track })
        ).catch((e) => console.error("transcription_start", track, e))
      )
    );
    return;
  }

  if (type === "call.transcription") {
    const state = decodeClientState<TranscriptionClientState>(payload.client_state);
    const td = payload.transcription_data;
    if (!state?.callId || !td?.is_final || !td.transcript) return;

    const { data: call } = await admin
      .from("sales_calls")
      .select("workspace_id")
      .eq("id", state.callId)
      .maybeSingle();
    if (!call) return;

    const { count } = await admin
      .from("sales_call_lines")
      .select("*", { count: "exact", head: true })
      .eq("call_id", state.callId);

    await admin.from("sales_call_lines").insert({
      workspace_id: (call as { workspace_id: string }).workspace_id,
      call_id: state.callId,
      speaker: state.track === "inbound" ? "rep" : "prospect",
      text: td.transcript,
      seq: count ?? 0,
    });
    return;
  }

  if (type === "call.hangup") {
    const state = decodeClientState<CallClientState>(payload.client_state);
    if (!state?.callId) return;
    const patch: { ended_at?: string; duration_seconds?: number } = {};
    if (payload.end_time) patch.ended_at = payload.end_time;
    if (payload.start_time && payload.end_time) {
      patch.duration_seconds = Math.max(
        0,
        Math.round(
          (Date.parse(payload.end_time) - Date.parse(payload.start_time)) / 1000
        )
      );
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("sales_calls").update(patch).eq("id", state.callId);
    }
    return;
  }
}
