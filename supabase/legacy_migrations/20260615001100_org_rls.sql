-- 20260615001100_org_rls.sql
-- Auth-gates ALL application data behind Row Level Security.
--
-- Model: every data row belongs to an ORGANIZATION (one row in `organizations`,
-- owned by one auth user). The owner sees everything they own. Other people are
-- invited as `org_members` and granted per-feature capability flags
-- (manage_files, manage_wells, …). A capability that's OFF = no access; ON =
-- read+write to that feature's data. This is enforced in the database via the
-- `has_capability(org_id, capability)` helper used by every table's policy, so
-- the service-role key is no longer the only thing standing between a request
-- and the data — the request-scoped client (user's JWT) is gated by RLS.
--
-- Append-only + idempotent: this migration does not edit earlier files and can
-- be run against a fresh or partially-migrated database.
--
-- PREREQUISITE: the data owner's auth account must exist. All current data is
-- backfilled to jimpoage@proton.me; the migration aborts loudly if that account
-- is not found in auth.users.

-- === 1. Organizations =======================================================
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  owner_uid  uuid not null unique references auth.users (id) on delete cascade,
  name       text not null default 'My Workspace',
  created_at timestamptz not null default now()
);
alter table organizations enable row level security;

-- === 2. org_members: link rows to an org + an auth identity =================
alter table org_members
  add column if not exists org_id uuid references organizations (id) on delete cascade;
alter table org_members
  add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;
create index if not exists org_members_org_idx on org_members (org_id);
create index if not exists org_members_auth_user_idx on org_members (auth_user_id);

-- === 3. Authorization helpers ===============================================
-- SECURITY DEFINER so they can read organizations/org_members without tripping
-- those tables' own RLS (which would recurse). auth.uid() still returns the
-- CALLING user's id inside a definer function.

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select id from organizations where owner_uid = auth.uid()),
    (select org_id from org_members
       where auth_user_id = auth.uid() and status = 'active'
       order by created_at limit 1)
  );
$$;

create or replace function is_org_owner(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from organizations where id = org and owner_uid = auth.uid()
  );
$$;

create or replace function has_capability(org uuid, cap text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_org_owner(org) or exists (
    select 1 from org_members m
    where m.org_id = org
      and m.auth_user_id = auth.uid()
      and m.status = 'active'
      and cap = any (m.permissions)
  );
$$;

-- === 4. Seed the org, backfill all data, enable RLS + policies ==============
do $$
declare
  v_owner uuid;
  v_org   uuid;
  v_all_caps text[] := array[
    'manage_members','manage_files','manage_wells','manage_tasks',
    'manage_inventory','manage_people','manage_calendar','view_financials',
    'use_orion'
  ];
  -- table -> capability that gates it
  tbl_caps text[][] := array[
    ['folders','manage_files'],
    ['files','manage_files'],
    ['file_placements','manage_files'],
    ['document_chunks','manage_files'],
    ['wells','manage_wells'],
    ['production_readings','manage_wells'],
    ['well_comments','manage_wells'],
    ['well_equipment','manage_wells'],
    ['tasks','manage_tasks'],
    ['inventory_items','manage_inventory'],
    ['contractors','manage_people'],
    ['service_providers','manage_people'],
    ['royalty_owners','manage_people'],
    ['royalty_owner_wells','manage_people'],
    ['calendar_events','manage_calendar'],
    ['conversations','use_orion'],
    ['messages','use_orion'],
    ['message_files','use_orion'],
    ['agent_memory','use_orion'],
    ['project_memory','use_orion'],
    ['orion_skills','use_orion']
  ];
  i int;
  t text;
  c text;
begin
  -- Resolve the data owner.
  select id into v_owner from auth.users where lower(email) = 'jimpoage@proton.me';
  if v_owner is null then
    raise exception
      'Data owner jimpoage@proton.me not found in auth.users. Create the account before running this migration.';
  end if;

  -- One org for the owner.
  insert into organizations (owner_uid, name)
  values (v_owner, 'My Workspace')
  on conflict (owner_uid) do nothing;
  select id into v_org from organizations where owner_uid = v_owner;

  -- Canonical owner membership row (correct the placeholder seed if present).
  delete from org_members where email = 'rankinpoage@gmail.com';
  insert into org_members (name, email, is_owner, permissions, status, org_id, auth_user_id)
  values ('Jim', 'jimpoage@proton.me', true, v_all_caps, 'active', v_org, v_owner)
  on conflict (email) do update
    set is_owner = true, org_id = v_org, auth_user_id = v_owner,
        permissions = v_all_caps, status = 'active';
  update org_members set org_id = v_org where org_id is null;

  -- The `users` directory table: org-scope + backfill.
  execute 'alter table users add column if not exists org_id uuid references organizations (id) on delete cascade';
  execute 'alter table users add column if not exists created_by uuid';
  execute format('update users set org_id = %L where org_id is null', v_org);
  execute 'alter table users alter column org_id set not null';
  execute 'alter table users alter column org_id set default current_org_id()';
  execute 'alter table users enable row level security';
  execute 'drop policy if exists users_read on users';
  execute 'create policy users_read on users for select using (org_id = current_org_id())';
  execute 'drop policy if exists users_write on users';
  execute 'create policy users_write on users for all using (has_capability(org_id, ''manage_members'')) with check (has_capability(org_id, ''manage_members''))';

  -- Every standard data table: add org_id/created_by, backfill, lock, RLS, policy.
  for i in 1 .. array_length(tbl_caps, 1) loop
    t := tbl_caps[i][1];
    c := tbl_caps[i][2];
    execute format('alter table %I add column if not exists org_id uuid references organizations (id) on delete cascade', t);
    execute format('alter table %I add column if not exists created_by uuid default auth.uid()', t);
    execute format('update %I set org_id = %L where org_id is null', t, v_org);
    execute format('alter table %I alter column org_id set not null', t);
    execute format('alter table %I alter column org_id set default current_org_id()', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_rls', t);
    execute format(
      'create policy %I on %I for all using (has_capability(org_id, %L)) with check (has_capability(org_id, %L))',
      t || '_rls', t, c, c
    );
  end loop;

  -- org_members itself: lock org_id now that every row has one.
  execute 'alter table org_members alter column org_id set not null';
  execute 'alter table org_members alter column org_id set default current_org_id()';
end $$;

-- === 5. Policies for the org-structure tables ===============================
alter table org_members enable row level security;
drop policy if exists org_members_read on org_members;
create policy org_members_read on org_members for select
  using (has_capability(org_id, 'manage_members') or auth_user_id = auth.uid());
drop policy if exists org_members_write on org_members;
create policy org_members_write on org_members for all
  using (has_capability(org_id, 'manage_members'))
  with check (has_capability(org_id, 'manage_members'));

drop policy if exists organizations_read on organizations;
create policy organizations_read on organizations for select
  using (id = current_org_id());
drop policy if exists organizations_write on organizations;
create policy organizations_write on organizations for all
  using (is_org_owner(id)) with check (is_org_owner(id));

-- === 6. profile: singleton -> per-user ======================================
-- Convert the boolean-singleton profile (if still that shape) into one row per
-- auth user, preserving the existing values for the data owner.
do $$
declare
  v_owner   uuid;
  v_name    text;
  v_company text;
  v_avatar  text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile'
      and column_name = 'id' and data_type = 'boolean'
  ) then
    select id into v_owner from auth.users where lower(email) = 'jimpoage@proton.me';
    select name, company_name, avatar_url into v_name, v_company, v_avatar
      from profile limit 1;

    drop table profile cascade;
    create table profile (
      user_id      uuid primary key references auth.users (id) on delete cascade default auth.uid(),
      name         text not null default '',
      company_name text not null default '',
      avatar_url   text,
      updated_at   timestamptz not null default now()
    );
    if v_owner is not null then
      insert into profile (user_id, name, company_name, avatar_url)
      values (v_owner, coalesce(v_name, ''), coalesce(v_company, ''), v_avatar);
    end if;
  end if;
end $$;

drop trigger if exists profile_set_updated_at on profile;
create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();
alter table profile enable row level security;
drop policy if exists profile_self on profile;
create policy profile_self on profile for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- === 7. Storage: lock the avatars bucket ====================================
-- Avatars are no longer public. All object bytes (files + avatars) are reached
-- only server-side via the service-role key, AFTER the request-scoped read of
-- the owning row passes RLS — so no per-object storage policies are needed
-- while both buckets stay private.
update storage.buckets set public = false where id = 'avatars';
