-- 20260626000100_sales_desk.sql
-- Wildcat cold-calling desk: prospects/queue, scripts+objections+follow-up
-- config, logged calls with transcript lines, follow-ups, and outbound numbers.
--
-- Workspace-shared tenancy: every table carries workspace_id defaulting to
-- app_default_workspace_id(), with an RLS policy scoping rows to the caller's
-- workspaces (app_workspace_ids()). The event trigger auto-enables RLS on new
-- tables; we add explicit enable + policy anyway so intent is obvious.
--
-- Config (script/objections/follow-up options) is stored as one JSONB row per
-- workspace because it is only ever read/written as a whole. Prospects, calls,
-- and follow-ups are normalized because they are queried and filtered.

create type call_status as enum (
  'new', 'no_answer', 'callback', 'meeting', 'not_interested', 'dnc'
);

-- Prospects / queue --------------------------------------------------------

create table sales_prospects (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null default app_default_workspace_id()
                   references workspaces (id) on delete cascade,
  name           text not null,
  title          text,
  company        text,
  phone          text not null,                 -- E.164 (or display) number
  email          text,
  location       text,                          -- "City, ST"
  area_code      text,                          -- NANP, for outbound selection
  status         call_status not null default 'new',
  queue_day      smallint check (queue_day between 1 and 5),  -- 1=Mon..5=Fri
  sort_order     numeric not null default 0,    -- order within a day column
  hook           text,                          -- one-line queue hook
  highlights     text[] not null default '{}',
  dossier        jsonb not null default '[]'::jsonb,          -- [{label,value}]
  last_called_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index sales_prospects_queue_idx
  on sales_prospects (workspace_id, queue_day, sort_order);

alter table sales_prospects enable row level security;
create policy sales_prospects_rw on sales_prospects
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

create trigger sales_prospects_set_updated_at
  before update on sales_prospects
  for each row execute function set_updated_at();

-- Desk config (one JSONB blob per workspace) -------------------------------

create table sales_config (
  workspace_id uuid primary key default app_default_workspace_id()
                 references workspaces (id) on delete cascade,
  config       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table sales_config enable row level security;
create policy sales_config_rw on sales_config
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

create trigger sales_config_set_updated_at
  before update on sales_config
  for each row execute function set_updated_at();

-- Calls (one row per dial) + transcript lines ------------------------------

create table sales_calls (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  prospect_id      uuid references sales_prospects (id) on delete set null,
  outbound_number  text,                         -- local number dialed from
  provider_call_id text,                         -- Telnyx call_control_id (Phase 3)
  status           call_status,                  -- outcome logged by the rep
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  notes            text,
  dossier_snapshot jsonb,                         -- dossier at call time
  created_at       timestamptz not null default now()
);
create index sales_calls_prospect_idx on sales_calls (prospect_id, started_at desc);
create index sales_calls_workspace_idx on sales_calls (workspace_id, started_at desc);

alter table sales_calls enable row level security;
create policy sales_calls_rw on sales_calls
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

create table sales_call_lines (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default app_default_workspace_id()
                 references workspaces (id) on delete cascade,
  call_id      uuid not null references sales_calls (id) on delete cascade,
  speaker      text not null check (speaker in ('rep', 'prospect')),
  text         text not null,
  at_ms        integer,
  -- DB-assigned so concurrent inserts get a monotonic order without a
  -- read-modify-write count in the app (the live Telnyx webhook writes the two
  -- transcription tracks concurrently). `by default` still lets batch writers
  -- (logCall) supply their own contiguous seq values.
  seq          bigint generated by default as identity,
  created_at   timestamptz not null default now()
);
create index sales_call_lines_call_idx on sales_call_lines (call_id, seq);

alter table sales_call_lines enable row level security;
create policy sales_call_lines_rw on sales_call_lines
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- Follow-ups ---------------------------------------------------------------

create table sales_follow_ups (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null default app_default_workspace_id()
                      references workspaces (id) on delete cascade,
  call_id           uuid references sales_calls (id) on delete set null,
  prospect_id       uuid references sales_prospects (id) on delete cascade,
  type              text not null
                      check (type in ('calendar_invite','scheduling_link','custom_email')),
  scheduled_for     timestamptz,
  duration_minutes  integer,
  meet_link         text,
  calendar_event_id text,
  email_subject     text,
  email_body        text,
  status            text not null default 'scheduled'
                      check (status in ('scheduled','sent','completed','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index sales_follow_ups_prospect_idx
  on sales_follow_ups (prospect_id, created_at desc);

alter table sales_follow_ups enable row level security;
create policy sales_follow_ups_rw on sales_follow_ups
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

create trigger sales_follow_ups_set_updated_at
  before update on sales_follow_ups
  for each row execute function set_updated_at();

-- Outbound numbers ---------------------------------------------------------

create table sales_outbound_numbers (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default app_default_workspace_id()
                 references workspaces (id) on delete cascade,
  e164         text not null,
  area_code    text not null,
  region       text,
  provider     text not null default 'telnyx',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (workspace_id, e164)
);

alter table sales_outbound_numbers enable row level security;
create policy sales_outbound_numbers_rw on sales_outbound_numbers
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- Realtime: the Desk live transcript subscribes to transcript-line inserts.
alter publication supabase_realtime add table sales_call_lines;
