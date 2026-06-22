-- 20260622000400_integration_settings.sql
-- Stores third-party integration credentials (currently Google Workspace for
-- Gmail + Calendar) so they can be managed from the Settings UI instead of only
-- via environment variables. Singleton row, like `profile`.
--
-- Security: these are secrets (OAuth client secret, refresh token). RLS is
-- enabled with NO policies, so the anon/authenticated data API cannot read or
-- write this table at all. Only the service-role client (getSupabaseAdmin),
-- used by the server-side settings actions and the Gmail/Calendar clients,
-- bypasses RLS. Secrets never reach the browser.

create table integration_settings (
  id                    boolean primary key default true check (id),  -- singleton
  google_client_id      text,
  google_client_secret  text,
  google_refresh_token  text,
  google_user_email     text,
  updated_at            timestamptz not null default now()
);

alter table integration_settings enable row level security;
-- Intentionally no policies: service-role only.

create trigger integration_settings_set_updated_at
  before update on integration_settings
  for each row execute function set_updated_at();

-- Seed the single row so updates can upsert against a known key.
insert into integration_settings (id) values (true)
on conflict (id) do nothing;
