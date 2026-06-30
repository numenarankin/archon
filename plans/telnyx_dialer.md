# Telnyx dialer (Phase 3 telephony)

We are moving off Plivo to Telnyx for outbound calling and live transcription, and
building our own in-app dialer. This doc captures the relevant Telnyx docs and how
they map onto the Sales desk (the `TelephonyProvider` boundary in
[cold_calling_implementation.md](./cold_calling_implementation.md)).

## Decision: browser WebRTC softphone + Call Control

Two Telnyx surfaces matter:

- **WebRTC JS SDK (`@telnyx/webrtc`)**: a browser softphone. The rep's mic/speaker
  run in the browser; we place PSTN calls from the Desk with `client.newCall(...)`.
- **Call Control (Voice API)**: server-side control of the same call via
  `call_control_id` and webhooks. This is where transcription and media streaming
  are turned on.

Recommended architecture: the browser places the call; our server controls it via
Call Control to start transcription. **Resolved from the docs:** a browser
`newCall` does NOT surface in Call Control by default. To get Call Control
webhooks + a `call_control_id`, enable **call parking** on the credential
connection:

```
PATCH /v2/credential_connections/{id}
{
  "webhook_event_url": "https://our-host/api/telnyx/webhook",
  "webhook_api_version": "2",
  "outbound": {
    "call_parking_enabled": true,
    "outbound_voice_profile_id": "<ovp_id>"
  }
}
```

With parking on, the SDK-initiated leg is parked and Telnyx fires `call.initiated`
to our webhook with a `call_control_id` (also exposed client-side as
`call.telnyxIDs.telnyxCallControlId`). The backend then issues `transcription_start`
and connects the call. The browser carries the audio; the server controls + transcribes.

```
Desk (browser)                     Our server (Next.js)            Telnyx
  @telnyx/webrtc  --- newCall --->  (caller ID = local number)  -> PSTN call to prospect
        ^                                                            |
        | remote audio                                              | webhooks (call.* )
        |                          POST /api/telnyx/webhook  <-------+
        |                            -> transcription_start(both)
        |                          call.transcription webhooks ----->|
        |                            -> insert sales_call_lines
   TranscriptPanel  <--- Supabase Realtime (sales_call_lines) ------ DB
```

## Prerequisites (Telnyx portal + API)

1. **API key** (`TELNYX_API_KEY`) for server-side REST calls.
2. **SIP Connection** of type *Credentials* (a "Voice API / Call Control"
   application). Note its `connection_id`. This connection both authenticates the
   WebRTC client and is the `connection_id` for Call Control.
3. **Outbound Voice Profile** associated with the application. Required for any
   outbound call (Dial/newCall) to be allowed; also sets billing + allowed
   destinations.
4. **Phone numbers** purchased for local presence (one per area code we want to
   match), stored in our `sales_outbound_numbers` table.
5. **Webhook URL** on the application pointing at `POST /api/telnyx/webhook`.

## 1. Authenticating the browser (JWT)

The SDK authenticates with a short-lived JWT minted server-side from an on-demand
telephony credential. Never ship SIP username/password to the browser.

Server (one credential per connection, reused; token per session):

```bash
# Create an on-demand credential bound to the SIP connection (once)
curl -X POST https://api.telnyx.com/v2/telephony_credentials \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "connection_id": "<connection_id>" }'
# -> { id, sip_username, sip_password, ... }

# Mint a JWT access token (default expiry 24h)
curl -X POST https://api.telnyx.com/v2/telephony_credentials/<credential_id>/token \
  -H "Authorization: Bearer $TELNYX_API_KEY"
# -> JWT string
```

We add a route handler `POST /api/telnyx/token` (gated by `view_sales`) that mints
and returns a token for the signed-in rep.

## 2. The dialer (browser, @telnyx/webrtc)

```
npm i @telnyx/webrtc        # v2.9.0 at time of writing (also @telnyx/react-client)
```

```ts
import { TelnyxRTC } from "@telnyx/webrtc";

const client = new TelnyxRTC({ login_token: jwtFromOurApi });

client
  .on("telnyx.ready", () => { /* registered, ready to dial */ })
  .on("telnyx.notification", (n) => {
    if (n.type === "callUpdate") {
      // n.call.state: "new" | "trying" | "ringing" | "active" | "held" |
      //               "hangup" | "destroy"
      attachRemoteAudio(n.call.remoteStream); // set <audio>.srcObject
    }
  });

client.connect();

// Place an outbound PSTN call with local-presence caller ID
const call = client.newCall({
  destinationNumber: prospect.phone,         // E.164
  callerNumber: pickOutboundNumber(areaCode).e164,
  callerName: "Wildcat",
});

// Controls
call.muteAudio();
call.unmuteAudio();
call.hangup();
```

Notes:
- `callerNumber` is our local-presence selection (reuse `pickOutboundNumber`).
- Remote audio arrives as a MediaStream on the call; bind it to an `<audio>`
  element's `srcObject`.
- Mic permission is requested by the SDK; handle the denied case.

This replaces the no-op "Dial" button on the Desk
([desk-view.tsx](../src/components/wildcat/sales/desk-view.tsx)).

## 3. Server-initiated dial (alternative)

If we ever want to dial without the browser (e.g. power dialer), Call Control's
Dial does it directly:

```bash
curl -X POST https://api.telnyx.com/v2/calls \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "<connection_id>",
    "to":   "+15555550199",
    "from": "+14325550100",
    "from_display_name": "Wildcat",
    "stream_url":   "wss://our-host/telnyx-media",
    "stream_track": "both_tracks"
  }'
# -> { data: { call_control_id, call_leg_id, ... } }
```

The WebRTC path is preferred for a rep-driven dialer; keep this for automation.

## 4. Live transcription

**Decision: Option A (Telnyx Call Control transcription).** We use Telnyx's
built-in real-time transcription for the call transcript and do not run ElevenLabs
on the call leg. Option B (media-stream to ElevenLabs) is kept only as a documented
fallback if we later need to keep audio in-house or want a different STT engine.

### Option A (chosen): Telnyx Call Control transcription

Command (verbatim params), issued on `call.answered`:

```
POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/transcription_start
{
  "transcription_engine": "Deepgram",        // Google|Telnyx|Deepgram|Azure|xAI|AssemblyAI|...
  "transcription_tracks": "inbound",         // inbound | outbound | both (default inbound)
  "transcription_engine_config": {
    "transcription_model": "deepgram/nova-3" // or deepgram/nova-2
  },
  "client_state": "<base64>",                // echoed on every call.transcription
  "command_id": "<uuid>"                     // idempotency
}
```

Transcription auto-stops on hangup (or `.../actions/transcription_stop`).

**The `call.transcription` webhook (verbatim):**

```json
{
  "data": {
    "record_type": "event",
    "event_type": "call.transcription",
    "payload": {
      "call_control_id": "v2:7subYr8f...",
      "client_state": null,
      "connection_id": "1240401930086254526",
      "transcription_data": {
        "confidence": 0.977219,
        "is_final": true,
        "transcript": "hello this is a test speech"
      }
    }
  }
}
```

Field paths: text = `payload.transcription_data.transcript`, final flag =
`...is_final` (interims are `false`, `confidence: 0.0`), state =
`payload.client_state`.

**IMPORTANT caveat (dual-channel labeling).** The `call.transcription` payload has
NO per-segment track field — nothing in it says rep vs prospect. So a single
`transcription_tracks: "both"` stream cannot be split by speaker. To label
`sales_call_lines.speaker`, run **two transcription_start commands** on the call,
one `"inbound"` and one `"outbound"`, each with a distinct `client_state`
(base64 of `{callId, track}`); the webhook handler reads `client_state` to know
the track. If concurrent transcriptions on one call turn out to be unsupported
(unconfirmed in the docs — VERIFY on a live call), the fallbacks are: (a) accept
unlabeled lines with Deepgram diarization, or (b) switch to Option B media
streaming, whose per-message `track` field is reliable.

Handler flow: decode `client_state` -> `{ callId, track }`; on `is_final`, insert a
`sales_call_lines` row (`speaker` = track==="inbound" ? "rep" : "prospect", text,
`seq` = next per-call counter). Hold interims client-side, replace on final. The
Desk `TranscriptPanel` subscribes to `sales_call_lines` via Supabase Realtime
(`live={true}`).

This likely removes the need to run ElevenLabs for the call transcript at all.

### Option B (fallback only, not building now): media streaming over WebSockets

Start raw audio streaming instead, and run STT ourselves:

```
POST .../actions/streaming_start   { "stream_url": "wss://...", "stream_track": "both_tracks" }
# or set stream_url + stream_track on the Dial command above
```

Telnyx opens a WebSocket to `stream_url` and sends:

```json
// once, at start
{ "event": "start", "start": { "call_control_id": "v2:...",
  "media_format": { "encoding": "PCMU", "sample_rate": 8000, "channels": 1 } },
  "stream_id": "..." }

// continuously
{ "event": "media", "media": { "track": "inbound", "chunk": "2",
  "timestamp": "5", "payload": "<base64 RTP payload, no headers>" },
  "stream_id": "..." }
```

- Codecs: PCMU (default 8k), PCMA, G722, OPUS (8k/16k), AMR-WB, L16 (16k).
- `track` is `inbound`/`outbound` -> our `speaker` mapping for dual-channel.
- We decode base64 PCMU per track and feed ElevenLabs STT, then write
  `sales_call_lines` as above.
- Bidirectional (inject audio back) is supported via
  `stream_bidirectional_mode: "rtp"` + `stream_bidirectional_codec`, sending
  `media` events back (20ms-30s chunks, <=1/sec); control messages `clear`,
  `mark`, `dtmf`. Not needed for transcription-only.

Tradeoff: Option B reuses our STT and keeps audio in-house, but is materially
more work (WS server, codec decode, chunking). We are not building it; Option A is
the plan.

## 5. New server endpoints (Next.js route handlers)

### `POST /api/telnyx/token` - mint a WebRTC JWT

Gate on `view_sales`. Uses the `telnyx` Node SDK helper:

```ts
import Telnyx from "telnyx";
const telnyx = new Telnyx(process.env.TELNYX_API_KEY!);
// One credential per connection (mint once, store id in TELNYX_CREDENTIAL_ID):
//   POST /v2/telephony_credentials { connection_id }
const token = await telnyx.telephonyCredentials
  .generateAccessTokenFromCredential(process.env.TELNYX_CREDENTIAL_ID!);
return Response.json({ token });           // -> browser login_token, valid 24h
```

### `POST /api/telnyx/webhook` - Call Control events

Verify the signature with the SDK (requires the RAW body, not parsed JSON):

```ts
const telnyx = new Telnyx({
  apiKey: process.env.TELNYX_API_KEY,
  publicKey: process.env.TELNYX_PUBLIC_KEY,   // Base64, from Mission Control > Keys & Credentials
});
const raw = await req.text();
const event = telnyx.webhooks.unwrap(raw, { headers: Object.fromEntries(req.headers) });
// throws TelnyxWebhookVerificationError on bad signature (-> 401)
```

Signature scheme (for reference): headers `Telnyx-Signature-Ed25519` (base64) +
`Telnyx-Timestamp`; signed payload is `` `${timestamp}|${rawBody}` ``; Ed25519
verify against the account public key; reject if older than 300s.

Dispatch on `event.data.event_type` (verbatim payloads in section 9):
- `call.initiated` - upsert a `sales_calls` row, store
  `provider_call_id = payload.call_control_id`.
- `call.answered` - fire two `transcription_start` commands (inbound + outbound),
  each with `client_state = base64({ callId, track })`. Record `start_time`.
- `call.transcription` - decode `client_state`; on `is_final`, insert a
  `sales_call_lines` row (speaker from track).
- `call.hangup` - set `ended_at = payload.end_time`, and
  `duration_seconds = end_time - start_time` (`start_time` is on `answered`/`hangup`);
  store `hangup_cause`.

### `POST /api/telnyx/media` (only if we ever switch to Option B)

WebSocket endpoint for media streaming. Needs a WS-capable Node runtime (not edge).

All webhook writes use the service-role client (`getSupabaseAdmin`) since they run
without a user session, and must set `workspace_id` explicitly (resolve it from the
matching `sales_calls` row; the RLS default keys off `auth.uid()` which is null in a
webhook, and the capability policy from migration 0200 only applies to user
sessions, not the service role).

## 6. Mapping to our code (BUILT)

The scaffold is implemented and typechecks/lints clean. It no-ops gracefully
until the Telnyx env is set (the Dial button is disabled when `hasTelnyx()` is
false) and `@telnyx/webrtc` is installed.

- `src/lib/wildcat/telephony/telnyx.ts` - `hasTelnyx`, `mintWebrtcToken`,
  `startTranscription`, client_state encode/decode, `verifyTelnyxSignature`
  (Ed25519 via Node crypto, no SDK dep).
- `src/lib/wildcat/outbound.ts` - `pickOutboundNumber` + `areaCodeOf` + the
  area-code centroid table. Feeds `callerNumber`.
- `src/app/api/telnyx/token/route.ts` - mints the WebRTC JWT (gated on `view_sales`).
- `src/app/api/telnyx/webhook/route.ts` - verifies signature, drives
  `call.initiated/answered/transcription/hangup` into `sales_calls` /
  `sales_call_lines` via the service-role client.
- `src/lib/wildcat/sales-actions.ts` `startCall(...)` - selects the local number,
  creates the `sales_calls` row, returns `{ callerNumber, destinationNumber,
  clientState }` for the browser.
- `src/components/wildcat/sales/use-telnyx-dialer.ts` - the browser softphone
  (lazy-loads `@telnyx/webrtc`, `newCall`, mute/hangup, call state).
- `src/components/wildcat/sales/use-call-transcript.ts` - Supabase Realtime
  subscription on `sales_call_lines`.
- Desk (`desk-view.tsx`) - the `Dial` button calls the dialer; Mute/Hang up appear
  during a call; `TranscriptPanel` shows live lines while on a call.
- Migration adds `sales_call_lines` to the `supabase_realtime` publication.

Remaining to make it live: install `@telnyx/webrtc` (already in package.json),
apply the migrations, set the env vars, and complete the Telnyx dashboard setup
(section 1 + prerequisites).

## 7. Env vars

```
TELNYX_API_KEY=
TELNYX_CONNECTION_ID=                   # credential (SIP) connection id
TELNYX_CREDENTIAL_ID=                   # on-demand telephony credential (mint once)
TELNYX_OUTBOUND_VOICE_PROFILE_ID=       # for call_parking_enabled outbound block
TELNYX_PUBLIC_KEY=                      # webhook signature verification (Base64)
TELNYX_WEBHOOK_URL=                     # convenience / docs
```

## 8. Status of the earlier open questions

- **WebRTC call -> Call Control `call_control_id`? RESOLVED: yes, with parking.**
  Set `outbound.call_parking_enabled: true` on the credential connection and point
  its `webhook_event_url` at our handler. The leg parks, `call.initiated` fires with
  a `call_control_id` (also `call.telnyxIDs.telnyxCallControlId` client-side). See
  the architecture section.
- **`call.transcription` fields? RESOLVED, with a caveat.** `is_final`/`transcript`/
  `confidence` confirmed, but there is NO per-segment track field. Label rep vs
  prospect via two `client_state`-tagged transcriptions (section 4).
- **Still to VERIFY on a live call:** (1) that two concurrent `transcription_start`
  commands (inbound + outbound) run simultaneously on one call; if not, use the
  diarization or media-streaming fallback. (2) Whether parking an outbound WebRTC
  leg requires an explicit command to proceed/connect, or proceeds on its own.
  (3) Outbound Voice Profile destination allow-list + per-minute cost.
  (4) Local-presence compliance for the caller-ID number.

## 9. Call lifecycle webhook payloads (verbatim)

```json
// call.initiated  (payload excerpt)
{ "event_type": "call.initiated", "payload": {
  "call_control_id": "v3:Rzae...", "call_leg_id": "aebb45bc-...",
  "call_session_id": "aeb5639a-...", "connection_id": "1684641123236054244",
  "direction": "outgoing", "from": "+12182950349", "to": "+48661133089",
  "state": "bridging", "client_state": null } }

// call.answered
{ "event_type": "call.answered", "payload": {
  "call_control_id": "v3:Rzae...", "start_time": "2025-09-02T09:17:44.596122Z",
  "from": "+12182950349", "to": "+48661133089" } }

// call.hangup
{ "event_type": "call.hangup", "payload": {
  "call_control_id": "v3:Rzae...",
  "start_time": "2025-09-02T09:17:44.596122Z",
  "end_time":   "2025-09-02T09:18:06.396120Z",
  "hangup_cause": "normal_clearing", "hangup_source": "callee",
  "sip_hangup_cause": "200" } }
```

`duration_seconds = end_time - start_time`. Engine list for
`transcription_engine`: Google | Telnyx | Deepgram | Azure | xAI | AssemblyAI |
Speechmatics | Soniox | Parakeet. Deepgram config key is `transcription_model`
(`deepgram/nova-2`, `deepgram/nova-3`).

## Sources

- Voice API fundamentals: https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals
- Programmable Voice get-started: https://developers.telnyx.com/docs/voice/programmable-voice/get-started
- Dial (Call Control) API: https://developers.telnyx.com/api/call-control/dial-call
- transcription_start: https://developers.telnyx.com/api-reference/call-commands/transcription-start
- Media streaming over WebSockets: https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming
- Webhook signature verification (header + signed-payload): https://support.telnyx.com/en/articles/4334722-how-to-leverage-webhooks
- WebRTC overview + credential-connection parking: https://developers.telnyx.com/docs/voice/webrtc
- WebRTC make a call (browser): https://developers.telnyx.com/docs/voice/webrtc/make-a-call-to-a-web-browser
- `@telnyx/webrtc` on npm: https://www.npmjs.com/package/@telnyx/webrtc
- WebRTC JS SDK API ref (TelnyxRTC / Call classes): https://github.com/team-telnyx/webrtc
- `telnyx` Node SDK (webhooks.unwrap, token helper): https://github.com/team-telnyx/telnyx-node
- Machine-readable docs index: https://developers.telnyx.com/llms.txt and https://telnyx.com/llms/calling/voice-api-full.txt
- Media streaming over WebSockets: https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming
- Transcription start command: https://developers.telnyx.com/api-reference/call-commands/transcription-start
- Real-time transcription (help center): https://support.telnyx.com/en/articles/8292490-real-time-transcription
