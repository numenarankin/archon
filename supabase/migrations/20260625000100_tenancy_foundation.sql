-- 20260625000100_tenancy_foundation.sql
-- Multi-tenant foundation: workspaces, membership, entitlements, and the SQL
-- helpers that every RLS policy in later migrations relies on.
--
-- Model: per-user now, org-ready. On signup each user gets one workspace and is
-- its sole `owner` member, so "my workspace" == "me" today. Later, adding more
-- members to a workspace makes org-shared tables visible to them while
-- user-private tables stay restricted to their owner.
--
-- NOTE on rls_auto_enable: an event trigger auto-enables RLS on every new public
-- table but adds NO policies, so a fresh table is fully LOCKED until policies are
-- created here. That is why each table below gets explicit policies in the same
-- migration.

-- Tables -------------------------------------------------------------------

create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Workspace',
  created_at timestamptz not null default now()
);

-- Membership maps an auth user to a workspace with a role. user_id references
-- auth.users so RLS can compare directly against auth.uid().
create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members (user_id);

-- Feature entitlements granted to a workspace (e.g. access to RRC reference data
-- or enrichment PII). Absence of a row == not entitled.
create table workspace_entitlements (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  feature      text not null check (feature in ('rrc_data', 'enrichment')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, feature)
);

-- Helpers ------------------------------------------------------------------
-- All SECURITY DEFINER + owned by the migration role (a table owner), so they
-- run without RLS and avoid recursion when called from within a policy. Marked
-- stable, search_path locked, execute granted to authenticated only.

create or replace function app_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = auth.uid();
$$;

create or replace function app_default_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1;
$$;

create or replace function app_workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_members m
  where m.user_id = auth.uid()
    and m.workspace_id = ws;
$$;

create or replace function app_has_entitlement(feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_entitlements e
    join public.workspace_members m on m.workspace_id = e.workspace_id
    where m.user_id = auth.uid()
      and e.feature = app_has_entitlement.feature
  );
$$;

revoke execute on function app_workspace_ids()            from public, anon;
revoke execute on function app_default_workspace_id()     from public, anon;
revoke execute on function app_workspace_role(uuid)       from public, anon;
revoke execute on function app_has_entitlement(text)      from public, anon;
grant  execute on function app_workspace_ids()            to authenticated;
grant  execute on function app_default_workspace_id()     to authenticated;
grant  execute on function app_workspace_role(uuid)       to authenticated;
grant  execute on function app_has_entitlement(text)      to authenticated;

-- RLS ----------------------------------------------------------------------
-- rls_auto_enable already turned RLS on; enable again defensively (idempotent).

alter table workspaces            enable row level security;
alter table workspace_members     enable row level security;
alter table workspace_entitlements enable row level security;

-- A user can read workspaces they belong to. Creation/rename happens via the
-- service-role client during provisioning, so no insert policy for authenticated;
-- admins/owners may rename.
create policy workspaces_select_member on workspaces
  for select to authenticated
  using (id in (select app_workspace_ids()));

create policy workspaces_update_admin on workspaces
  for update to authenticated
  using (app_workspace_role(id) in ('owner', 'admin'))
  with check (app_workspace_role(id) in ('owner', 'admin'));

-- A user can read the membership rows of workspaces they belong to (roster).
-- Membership changes (invites/role edits) go through service-role provisioning.
create policy workspace_members_select on workspace_members
  for select to authenticated
  using (workspace_id in (select app_workspace_ids()));

-- A user can read the entitlements of their own workspaces (to gate UI). Grants
-- are written by billing/provisioning via the service-role client.
create policy workspace_entitlements_select on workspace_entitlements
  for select to authenticated
  using (workspace_id in (select app_workspace_ids()));
