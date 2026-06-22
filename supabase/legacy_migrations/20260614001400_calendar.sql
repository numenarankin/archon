-- 20260614001400_calendar.sql
-- Operations calendar events (field work, maintenance, hauling, deadlines).

create type event_category as enum (
  'production',
  'maintenance',
  'logistics',
  'compliance',
  'office'
);

create table calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,
  all_day     boolean not null default true,
  start_time  time,                                  -- null for all-day events
  end_time    time,
  category    event_category not null default 'office',
  location    text,
  people      text[],                                -- free-form attendee names
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index calendar_events_date_idx on calendar_events (event_date);
create trigger calendar_events_set_updated_at
  before update on calendar_events
  for each row execute function set_updated_at();
