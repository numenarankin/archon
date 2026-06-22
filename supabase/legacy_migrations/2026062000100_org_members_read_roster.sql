-- 2026062000100_org_members_read_roster.sql
-- Let every active member read their org's full member roster.
--
-- The original org_members_read policy (20260615001100_org_rls.sql) only let a
-- member read their OWN row unless they held `manage_members`. So an invited
-- member couldn't see the owner — or anyone else — in Organization > Members.
-- Reading the roster is harmless (it's the team list); writes stay gated on
-- `manage_members` via the unchanged org_members_write policy.
--
-- current_org_id() resolves to the caller's own org, so this never exposes rows
-- from another organization.
--
-- Append-only + idempotent: safe to re-run.

drop policy if exists org_members_read on org_members;
create policy org_members_read on org_members for select
  using (org_id = current_org_id());
