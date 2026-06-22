-- 20260615001000_access_codes.sql
-- Invite gate for sign-ups. Each row pairs an allowed email address with the
-- access code that email must enter to create an account. Account creation is
-- only permitted when the submitted (email, code) matches a row here.
--
-- Emails are stored lower-cased so lookups are case-insensitive; the verify
-- endpoint lower-cases the submitted email before matching.

create table access_codes (
  email      text primary key,
  code       text not null,
  -- Set once the code has been redeemed, so a code can't be reused to create
  -- multiple accounts. NULL means unused.
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- These are invite secrets: the browser must NEVER be able to read them.
-- Enabling RLS with no policies denies all access via the publishable/anon key;
-- only the server's secret (service-role) key bypasses RLS to validate codes.
alter table access_codes enable row level security;

-- Example: grant an invite (run with the secret key / SQL editor).
-- insert into access_codes (email, code)
-- values ('rankinpoage@gmail.com', 'CHANGE-ME')
-- on conflict (email) do update set code = excluded.code, used_at = null;
