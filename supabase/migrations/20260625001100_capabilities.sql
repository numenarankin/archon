-- 20260625001100_capabilities.sql
-- Hard (database-enforced) per-member capability checks, so an admin can restrict
-- a member from sensitive data and a restricted member cannot read it even by
-- hitting the API directly. Backs the per-member permission toggles in Settings.
--
-- A workspace owner/admin implicitly holds every capability; a plain member holds
-- exactly the (expanded) capabilities stored in workspace_members.permissions.
-- The app stores the EXPANDED permission set (see setMemberPermissions), so the
-- check is a simple array membership.

create or replace function app_has_capability(cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = auth.uid()
      and (
        m.role in ('owner', 'admin')
        or app_has_capability.cap = any(m.permissions)
      )
  );
$$;
revoke execute on function app_has_capability(text) from public, anon;
grant execute on function app_has_capability(text) to authenticated;

-- ── Prospect PII: entitlement (workspace owns the feature) AND per-member
-- capability (this member is allowed to see prospect lists). ─────────────────
drop policy if exists operator_contacts_read on operator_contacts;
create policy operator_contacts_read on operator_contacts
  for select to authenticated
  using (app_has_entitlement('enrichment') and app_has_capability('view_prospects'));
