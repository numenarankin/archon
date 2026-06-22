-- 2026061600200_org_referrals.sql
-- Referral codes + onboarding fields on `organizations`.
--
-- Every org gets its own shareable referral code (6-hex), generated server-side
-- when the admin's account is created. A new org that signs up WITH a referral
-- code records which org referred it (`referred_by_org`); the billing agent
-- reads that edge to reward both parties (2 months free for the new org, 1 free
-- month credited back to the referrer).
--
-- Onboarding (admin only) captures company address, employee count, and well
-- count. Well count drives the recommended subscription tier. `name` (company
-- name) already exists on the table and is reused.
--
-- Append-only + idempotent.

alter table organizations
  add column if not exists referral_code text unique,
  add column if not exists referred_by_org uuid references organizations (id),
  add column if not exists company_address text,
  add column if not exists employee_count int,
  add column if not exists well_count int,
  add column if not exists recommended_tier text,
  add column if not exists onboarding_completed_at timestamptz;
