Phone numbers for outbound calling acquired via Telnyx, and we build our own in-app dialer on Telnyx's WebRTC SDK. App should automatically select the number which is closest to the area code of the target. Both channels (rep + counterparty) are transcribed live via Telnyx's built-in real-time transcription (Call Control). The `call.transcription` webhook carries no per-line track, so rep vs prospect is labeled by running two `client_state`-tagged transcriptions (inbound + outbound); ElevenLabs is not used on the call leg. Telephony specifics live in [telnyx_dialer.md](./telnyx_dialer.md).

Script and objections handled in supabase. Queue as an ordered list by day in supabase. Call transcripts and notes stored in supabase. Need to store all call metadata such as time, status, etc.

## Current state (prototype)

The Sales surface already exists as a working UI prototype on mock data at `/wildcat/sales`, gated by the `view_prospects` permission. It has four tabs:

- **Queue**: five day columns (Mon to Fri), drag to reorder and move between days. Cards struck through once dialed this week.
- **Desk**: lineup rail, active call card (toolbar, opening script, objections, dossier, notepad), live transcript panel.
- **History**: filterable table of past calls; row opens a detail modal (details, notes, transcript).
- **Config**: edit the opening script template, objections, and follow-up actions.

Backing types and mock data live in `src/lib/wildcat/sales.ts` (`Prospect`, `CallStatus`, `SalesConfig`, `CallRecord`, `FollowUpOption`). The job of this plan is to swap that mock layer for Supabase-backed data and live telephony without changing the component contracts where possible.

## Architecture

```
Browser (Sales tabs)
   |
   |  server actions (src/lib/wildcat/*.ts, "use server")
   v
Supabase (Postgres + RLS)        Telephony provider boundary (TBD)
   - prospects / queue              - placeCall(from, to)
   - scripts / objections / config  - dual-channel audio -> ElevenLabs STT
   - calls / transcript / notes     - hangup / call events
   - follow_ups / outbound_numbers
```

The telephony provider (Telnyx) sits behind an interface so the rest of the app does not depend on it. Phase 3 below is the live-calling slice (see [telnyx_dialer.md](./telnyx_dialer.md)). Phases 1 and 2 deliver a fully usable, Supabase-backed desk with manual call logging and working follow-ups, independent of telephony.

## Data model (Supabase)

Conventions follow the existing migrations: `uuid` PKs with `gen_random_uuid()`, `created_at`/`updated_at timestamptz`, the shared `set_updated_at()` trigger, and explicit RLS policies (an event trigger auto-enables RLS on every new table, so each needs a policy or it stays locked). New tables are workspace-shared, scoped with the `app_workspace_ids()` helper from `20260625000100_tenancy_foundation.sql`. Add a single migration, e.g. `supabase/migrations/2026XXXX_sales_desk.sql`.

### Status enum

```sql
create type call_status as enum (
  'new', 'no_answer', 'callback', 'meeting', 'not_interested', 'dnc'
);
```

Maps 1:1 to `CallStatus` in `sales.ts`. `new` is queue-only (never written to a completed `calls` row).

### Prospects and queue

```sql
create table sales_prospects (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces (id) on delete cascade,
  name           text not null,
  title          text,
  company        text,
  phone          text not null,                 -- E.164
  email          text,
  location       text,                          -- "City, ST"
  area_code      text,                          -- NANP, for outbound number selection
  status         call_status not null default 'new',
  queue_day      smallint check (queue_day between 1 and 5),  -- 1=Mon..5=Fri, null=unscheduled
  sort_order     numeric not null default 0,    -- order within a day column
  dossier        jsonb not null default '[]'::jsonb,          -- [{label,value}]
  highlights     text[] not null default '{}',
  last_called_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index sales_prospects_queue_idx on sales_prospects (workspace_id, queue_day, sort_order);
```

Replaces the generated `Prospect` list. The prototype's `day` weekday key becomes `queue_day`; array order becomes `sort_order`. "Called this week" is `last_called_at >= date_trunc('week', now())` (the UI strike-through), rather than just `status != 'new'`.

### Config: scripts, objections, follow-up options

```sql
create table sales_scripts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  body         text not null,                   -- template with {first} {company} {city} {title}
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table sales_objections (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  trigger      text not null,
  response     text not null,
  sort_order   numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table sales_followup_options (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  type         text not null check (type in ('calendar_invite','scheduling_link','custom_email')),
  label        text not null,
  enabled      boolean not null default true,
  config       jsonb not null default '{}'::jsonb,  -- {schedulingUrl}|{duration}|{emailSubject,emailBody}
  sort_order   numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

These mirror `SalesConfig` (`openingScript`, `objections`, `followUps`). The Config tab reads and writes them. The Desk renders the active script per prospect by substituting tokens (already done client-side by `renderTemplate`).

### Calls: metadata, notes, transcript

```sql
create table calls (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  prospect_id      uuid references sales_prospects (id) on delete set null,
  outbound_number  text,                         -- the local number dialed from
  provider_call_id text,                         -- Telnyx call_control_id (Phase 3)
  status           call_status,                  -- outcome logged by the rep
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer,
  notes            text,                          -- rep notes captured on the card
  dossier_snapshot jsonb,                         -- dossier at call time (if edited)
  created_at       timestamptz not null default now()
);
create index calls_prospect_idx on calls (prospect_id, started_at desc);
create index calls_workspace_started_idx on calls (workspace_id, started_at desc);

create table call_transcript_lines (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references calls (id) on delete cascade,
  speaker    text not null check (speaker in ('rep','prospect')),
  text       text not null,
  at_ms      integer,                            -- offset from call start
  seq        integer not null,                   -- ordering
  created_at timestamptz not null default now()
);
create index call_transcript_call_idx on call_transcript_lines (call_id, seq);
```

Transcript lines are appended as they arrive (Phase 3) or inserted in bulk on save. A call's History row and detail modal read from `calls` + `call_transcript_lines`. The detail modal already treats the transcript as a completed record (`live={false}`).

### Follow-ups

```sql
create table follow_ups (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  call_id          uuid references calls (id) on delete set null,
  prospect_id      uuid not null references sales_prospects (id) on delete cascade,
  type             text not null check (type in ('calendar_invite','scheduling_link','custom_email')),
  scheduled_for    timestamptz,                  -- calendar_invite
  duration_minutes integer,                      -- calendar_invite
  meet_link        text,                         -- calendar_invite (from Calendar API)
  calendar_event_id text,                        -- Google event id, for edits/cancels
  email_subject    text,
  email_body       text,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','sent','completed','cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index follow_ups_prospect_idx on follow_ups (prospect_id, created_at desc);
```

The follow-up modal writes one row per action. The Google Calendar + Meet path is detailed in the section below.

### Outbound numbers

```sql
create table outbound_numbers (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  e164        text not null,
  area_code   text not null,
  region      text,                              -- "Midland, TX" label
  provider    text not null default 'telnyx',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (workspace_id, e164)
);
```

### RLS

Each table gets a workspace-scoped policy, for example:

```sql
alter table sales_prospects enable row level security;  -- belt-and-suspenders; event trigger also enables it
create policy sales_prospects_rw on sales_prospects
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));
```

Repeat for every table above.

## Outbound number selection (area-code proximity)

Goal: dial from the owned number closest to the prospect's area code so the call shows as local. This needs no provider specifics, only the selection logic; the chosen number becomes the Telnyx `callerNumber`.

1. Derive `area_code` for each prospect (parse from `phone`, or geocode from `location`).
2. Maintain a static NANP table mapping `area_code -> { lat, lng, state }` (ship as a JSON asset under `src/lib/wildcat/area-codes.json`; the NANPA list is public).
3. Selection order:
   - exact area-code match among `active` numbers, else
   - same state, else
   - minimum great-circle distance between area-code centroids, else
   - a configured default number.

Implement as a pure helper `pickOutboundNumber(targetAreaCode, numbers): OutboundNumber` in `src/lib/wildcat/outbound.ts` so it is unit-testable independent of telephony.

## Server action / API surface

Replace the mock functions in `src/lib/wildcat/sales.ts` with `"use server"` actions (or route handlers where streaming is needed). Suggested surface and the prototype component that calls each:

| Function | Consumer (prototype) | Notes |
| --- | --- | --- |
| `getQueue()` | `SalesWorkspace` page load | prospects grouped by `queue_day`, ordered by `sort_order` |
| `saveQueueOrder(moves)` | `queue-board.tsx`, `desk-view.tsx` lineup | persist day + sort_order after drag |
| `getSalesConfig()` | `config-panel.tsx`, `desk-view.tsx` | script + objections + follow-up options |
| `updateScript(body)` / `upsertObjection(o)` / `deleteObjection(id)` / `updateFollowUpOption(o)` | `config-panel.tsx` | config writes |
| `startCall(prospectId)` -> `{ callId, outboundNumber }` | `card-toolbar.tsx` Dial | creates a `calls` row, selects outbound number, kicks the provider (Phase 3) |
| `appendTranscriptLine(callId, line)` | transcription stream (Phase 3) | server-side; UI reads via subscription |
| `endCall(callId, { status, notes, dossier })` | `call-card.tsx` "Log & next" | writes outcome, sets `prospect.status` + `last_called_at`, snapshots dossier |
| `getCallHistory({ status, date })` | `call-history.tsx` | filters map to existing UI filters |
| `scheduleFollowUp(input)` | `follow-up-modal.tsx` Send | calendar/meet/email; returns `meet_link` etc. |
| `updateCallStatus(callId, status)` | `call-record-modal.tsx` | status edit from History |

Live transcript on the Desk should use a Supabase Realtime subscription on `call_transcript_lines` filtered by `call_id`, so the panel updates as rows are inserted. `TranscriptPanel` already accepts a `lines` array; feed it from the subscription with `live={true}`.

## Telephony provider boundary (Phase 3, Telnyx)

Full Telnyx spec (WebRTC dialer, transcription, webhooks, env): [telnyx_dialer.md](./telnyx_dialer.md).

Define an interface so the provider is swappable and the desk does not import it directly:

```ts
// src/lib/wildcat/telephony/provider.ts
export interface TelephonyProvider {
  placeCall(input: { from: string; to: string; callId: string }): Promise<{ providerCallId: string }>;
  hangup(providerCallId: string): Promise<void>;
  // Dual-channel media is bridged to ElevenLabs STT out of band; the provider
  // emits transcript lines via a webhook/stream that calls appendTranscriptLine.
}
```

For Telnyx, `placeCall` is mostly the browser-side `newCall` from the WebRTC SDK, and transcript lines arrive via the Call Control webhook (`call.transcription`) rather than an out-of-band bridge. Until the dialer is built, `startCall` runs in a "manual" mode (no real dial) and the rep logs the outcome by hand. See [telnyx_dialer.md](./telnyx_dialer.md) for the concrete API calls.

## Phasing

- **Phase 1 (no telephony): Supabase data layer.** Add the migration, seed config defaults, and replace the mock functions in `sales.ts` with real queries. The four tabs work on real data; calls are logged manually via "Log & next". Deliverable: a usable CRM desk.
- **Phase 2: Follow-ups.** Wire `scheduleFollowUp` to Google Calendar + Meet (next section) and email. Persist `follow_ups` rows; surface scheduled items on the prospect.
- **Phase 3: live calling + transcription (Telnyx).** Build the WebRTC dialer (browser `newCall` with call parking so the call surfaces in Call Control), start two `client_state`-tagged Deepgram transcriptions (inbound + outbound), insert `call.transcription` webhooks into `sales_call_lines`, and switch the Desk transcript to a Supabase Realtime subscription. Details in [telnyx_dialer.md](./telnyx_dialer.md).

## Permissions

- `view_prospects` (already gating the page) for read access to the Sales tabs.
- Add `manage_prospects` for writes: editing the queue, config, logging calls, and scheduling follow-ups. Gate the mutating server actions on it.

## Follow-up: Google Calendar + Meet integration

The "Send calendar invite" follow-up action creates a real Google Calendar event (with an optional Google Meet link) and emails the invite to the prospect. Most of the plumbing already exists in `src/lib/calendar/google-calendar.ts`, which talks to the Calendar REST API v3 over `fetch` using the same Google Workspace OAuth credentials as Gmail (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_USER_EMAIL`). It just does not request a Meet conference yet.

### Step 1: OAuth scope

The current refresh token likely only carries the Gmail scope. Re-consent including the Calendar scope so the token can write events:

```
https://www.googleapis.com/auth/calendar
```

Setup steps live in `docs/gmail.md`; add the Calendar scope when authorizing.

### Step 2: Request a Meet conference on event creation

In `src/lib/calendar/google-calendar.ts`:

- Extend `GoogleCalendarEventInput` with `addMeet: boolean` and `durationMin: number` (so the modal's length chip drives the end time).
- In `toGoogleEvent()`, when `addMeet` is on, attach a unique conference create request:

```ts
base.conferenceData = {
  createRequest: {
    requestId: crypto.randomUUID(),              // must be unique per request
    conferenceSolutionKey: { type: "hangoutsMeet" },
  },
};
```

- In `createGoogleCalendarEvent()`, the POST URL must carry `conferenceDataVersion=1` (required, or the Meet request is silently ignored) and `sendUpdates=all` (so Google emails the invite to attendees automatically):

```ts
const url = `${CALENDAR_API}?conferenceDataVersion=1&sendUpdates=all`;
```

- Attendees currently go out as `{ displayName }` only. Add the prospect's `email` so the invite actually delivers.

### Step 3: Read the Meet link back

The created event returns `hangoutLink` (and `conferenceData.entryPoints[].uri`). The first response can come back with conferenceData status `pending`; it flips to `success` once the link is provisioned, so re-fetch the event if `hangoutLink` is empty on the initial response.

### Step 4: Wire the modal Send handler

Replace the prototype's mock confirmation in `src/components/wildcat/sales/follow-up-modal.tsx` (calendar branch) with a server action that calls `createGoogleCalendarEvent({ ...date, time, durationMin, addMeet, people: [{ name, email }] })`, then surfaces the returned Meet link in the confirmation. Default the date to "tomorrow" server-side (the client component currently uses a fixed constant to avoid hydration mismatch).

### Event request body reference

```json
{
  "summary": "Wildcat intro",
  "start": { "dateTime": "2026-06-26T10:00:00-05:00", "timeZone": "America/Chicago" },
  "end":   { "dateTime": "2026-06-26T10:30:00-05:00", "timeZone": "America/Chicago" },
  "attendees": [{ "email": "prospect@example.com" }],
  "conferenceData": {
    "createRequest": {
      "requestId": "unique-per-request",
      "conferenceSolutionKey": { "type": "hangoutsMeet" }
    }
  }
}
```

Sources:
- Events: insert reference: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Create events guide (conferenceData / conferenceDataVersion): https://developers.google.com/workspace/calendar/api/guides/create-events
- Hangouts Meet in the Calendar API (announcement): https://workspace.google.com/blog/product-announcements/hangouts-meet-now-available-in-google

