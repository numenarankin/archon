-- 20260615000900_org_members.sql
-- Members of the organization, managed on Settings → Organization. The org can
-- invite people (by name + email; status 'invited' until they accept), remove
-- them, and toggle which functionality each one is allowed via granular
-- capability flags. Prototype-era: one org, so this is a flat list with no
-- org_id. When real auth + multi-tenancy land this gains an org_id and links to
-- users.id / auth.users.

create table org_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  email       text not null unique,
  -- The single workspace owner: full access, can't be removed or edited away.
  is_owner    boolean not null default false,
  -- Granular capability flags the org grants this member. Keys are validated in
  -- code against PERMISSION_DEFS (src/lib/settings/org.ts).
  permissions text[] not null default '{}',
  status      text not null default 'invited'
                check (status in ('active', 'invited')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger org_members_set_updated_at
  before update on org_members
  for each row execute function set_updated_at();

-- Seed the workspace owner (the current prototype user) with full access so the
-- list is never empty and there is always exactly one owner.
insert into org_members (name, email, is_owner, permissions, status)
values (
  'Jim',
  'rankinpoage@gmail.com',
  true,
  array[
    'manage_members', 'manage_files', 'manage_wells', 'manage_tasks',
    'manage_inventory', 'view_financials', 'use_orion'
  ],
  'active'
)
on conflict (email) do nothing;
