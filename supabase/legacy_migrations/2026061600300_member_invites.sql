-- 2026061600300_member_invites.sql
-- Secure invite tokens + per-member identity fields on `org_members`.
--
-- Members join through a one-time invite link. The raw token lives ONLY in the
-- link; we persist its SHA-256 hash, an expiry (7 days), and an accepted-at
-- timestamp. A leaked DB row therefore can't be turned back into a working
-- link, and a token can't be replayed once accepted.
--
-- Member onboarding is minimal: first name, last name, and phone (everything
-- else — company, address, wells — is inherited from the org). `name` is kept
-- for back-compat/display; first/last become the source of truth.
--
-- Append-only + idempotent.

alter table org_members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_accepted_at timestamptz;

create index if not exists org_members_invite_token_idx
  on org_members (invite_token_hash);
