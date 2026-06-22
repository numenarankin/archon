-- 2026061900200_profile_phone.sql
-- Add an optional phone number to the per-user profile. The profile holds the
-- signed-in user's display name, company name, and avatar (see
-- 20260615001100_org_rls.sql, which recreated it keyed by user_id); the phone
-- is shown alongside the read-only email on the Settings > Profile section.
--
-- Append-only + idempotent: safe to re-run.

alter table profile
  add column if not exists phone text;
