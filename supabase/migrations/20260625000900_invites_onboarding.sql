-- 20260625000900_invites_onboarding.sql
-- Member invites + onboarding, ported from wildcat-webapp onto the workspaces /
-- workspace_members model.
--
-- Two entry paths:
--   (a) New owner signs up -> ensureWorkspace() creates their workspace with
--       onboarding_completed_at NULL -> the proxy gate sends them to /onboarding.
--   (b) Admin invites a teammate -> a workspace_invites row (status pending) +
--       email -> recipient sets a password at /invite/<token> -> accept route
--       creates their auth account and a workspace_members row in the inviter's
--       workspace. They own no workspace, so the onboarding gate never fires.

-- ── workspaces: onboarding + company details + explicit owner ────────────────
alter table workspaces
  add column if not exists owner_uid uuid references auth.users (id) on delete set null,
  add column if not exists company_address text,
  add column if not exists employee_count int,
  add column if not exists well_count int,
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill the founder workspace: stamp its owner and mark it already onboarded.
update workspaces w
set owner_uid = coalesce(
      w.owner_uid,
      (select m.user_id from workspace_members m
       where m.workspace_id = w.id and m.role = 'owner'
       order by m.created_at asc limit 1)),
    onboarding_completed_at = coalesce(w.onboarding_completed_at, now());

create index if not exists workspaces_owner_uid_idx on workspaces (owner_uid);

-- ── workspace_members: roster identity + per-member permissions ──────────────
-- name/email are denormalized for the roster (mirrors how the webapp stored them
-- on org_members); permissions drives the RBAC the settings UI edits. Owners and
-- admins are treated as full-access in code regardless of this array.
alter table workspace_members
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists permissions text[] not null default '{}';

-- Backfill the founder member's email from auth.
update workspace_members m
set email = coalesce(m.email, (select u.email from auth.users u where u.id = m.user_id))
where m.email is null;

-- ── workspace_invites: pending invitations (no auth user yet) ────────────────
create table workspace_invites (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces (id) on delete cascade,
  email             text not null,
  invited_name      text not null default '',
  role              text not null default 'member' check (role in ('admin', 'member')),
  permissions       text[] not null default '{}',
  invite_token_hash text not null,
  expires_at        timestamptz not null,
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  -- One outstanding invite per email per workspace.
  unique (workspace_id, email)
);
create index workspace_invites_token_idx on workspace_invites (invite_token_hash);
create index workspace_invites_workspace_idx on workspace_invites (workspace_id);

-- rls_auto_enable turns RLS on; add the policy so the table is reachable.
alter table workspace_invites enable row level security;
-- Workspace owners/admins manage their own workspace's invites. The accept flow
-- runs through the service-role client (no session yet), which bypasses RLS.
create policy workspace_invites_admin on workspace_invites
  for all to authenticated
  using (app_workspace_role(workspace_id) in ('owner', 'admin'))
  with check (app_workspace_role(workspace_id) in ('owner', 'admin'));
