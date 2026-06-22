-- 2026061600100_drop_access_codes.sql
-- Remove invite-gated sign-up. Account creation is no longer gated by an
-- (email, access code) pair: admins self-serve sign up to create an org, and
-- members join via a secure invite link (see member invite tokens). The
-- access_codes table and its server-side verifier are retired.
--
-- Idempotent: safe to run whether or not the table still exists.

drop table if exists access_codes;
