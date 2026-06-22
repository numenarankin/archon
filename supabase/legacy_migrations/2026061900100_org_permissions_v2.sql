-- 2026061900100_org_permissions_v2.sql
-- Finer-grained member permissions.
--
-- Builds on 20260615001100_org_rls.sql. Three changes:
--   1. `admin` capability: a member who holds 'admin' implicitly holds every
--      capability (the owner already bypasses checks via is_org_owner).
--   2. view/manage split: capabilities that come in a "view X" / "manage X" pair
--      get separate SELECT and write policies, so a viewer can read but not edit.
--      A new `has_any_capability(org, caps[])` helper backs the read policies.
--   3. Taxonomy migration: the coarse legacy keys (manage_wells, manage_people,
--      view_financials, manage_calendar, use_orion) are expanded into the new
--      fine-grained keys on every existing member, and owners are granted all.
--
-- Append-only + idempotent: safe to re-run.

-- === 1. admin-aware capability checks =======================================
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
      and ('admin' = any (m.permissions) or cap = any (m.permissions))
  );
$$;

-- True if the member holds ANY of `caps` (or 'admin', or owns the org). Backs
-- the SELECT side of every view/manage split — read access is granted when the
-- member has either the view OR the manage capability.
create or replace function has_any_capability(org uuid, caps text[])
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
      and ('admin' = any (m.permissions) or m.permissions && caps)
  );
$$;

-- === 2. Migrate stored permission keys to the new taxonomy ==================
do $$
declare
  v_all text[] := array[
    'admin','manage_members','manage_files','add_wells','view_well_production',
    'manage_well_production','manage_well_equipment','view_well_files',
    'manage_well_files','view_royalty_owners','manage_royalty_owners',
    'manage_projects','manage_inventory','use_ai','buy_ai_credits','manage_tasks',
    'manage_personal_calendar','manage_org_calendar','view_accounting',
    'manage_accounting','view_analytics','view_pricing','manage_skills'
  ];
  r record;
  newp text[];
  p text;
begin
  for r in select id, is_owner, permissions from org_members loop
    if r.is_owner then
      update org_members set permissions = v_all where id = r.id;
      continue;
    end if;
    newp := '{}';
    foreach p in array coalesce(r.permissions, '{}') loop
      newp := newp || case p
        when 'manage_wells' then array[
          'add_wells','view_well_production','manage_well_production',
          'manage_well_equipment','view_well_files','manage_well_files',
          'manage_projects']
        when 'manage_people' then array['view_royalty_owners','manage_royalty_owners']
        when 'view_financials' then array['view_accounting','manage_accounting']
        when 'manage_calendar' then array['manage_personal_calendar','manage_org_calendar']
        when 'use_orion' then array['use_ai','manage_skills']
        else array[p]
      end;
    end loop;
    -- De-dupe and drop any keys no longer in the catalog.
    update org_members
      set permissions = (
        select coalesce(array_agg(distinct x), '{}')
        from unnest(newp) x
        where x = any (v_all)
      )
      where id = r.id;
  end loop;
end $$;

-- === 3. view/manage read-write split policies ===============================
-- For each table: a SELECT policy granting read to anyone holding any of the
-- read caps, plus a FOR ALL policy gating writes (insert/update/delete) on the
-- manage caps. Two permissive policies are OR-combined, so managers still read.
do $$
declare
  -- [table, comma-separated read caps, comma-separated write caps]
  splits text[][] := array[
    ['wells',
     'add_wells,view_well_production,manage_well_production,manage_well_equipment,view_well_files,manage_well_files,manage_projects',
     'add_wells'],
    ['production_readings',
     'view_well_production,manage_well_production',
     'manage_well_production'],
    ['well_comments',
     'view_well_production,manage_well_production,manage_well_equipment,add_wells',
     'manage_well_production,manage_well_equipment,add_wells'],
    ['well_equipment',
     'manage_well_equipment,view_well_production,manage_well_production',
     'manage_well_equipment'],
    ['royalty_owners',
     'view_royalty_owners,manage_royalty_owners',
     'manage_royalty_owners'],
    ['royalty_owner_wells',
     'view_royalty_owners,manage_royalty_owners',
     'manage_royalty_owners'],
    ['contractors',
     'view_royalty_owners,manage_royalty_owners',
     'manage_royalty_owners'],
    ['service_providers',
     'view_royalty_owners,manage_royalty_owners',
     'manage_royalty_owners'],
    ['calendar_events',
     'manage_personal_calendar,manage_org_calendar',
     'manage_personal_calendar,manage_org_calendar'],
    ['transactions',
     'view_accounting,manage_accounting',
     'manage_accounting'],
    ['accounting_uploads',
     'view_accounting,manage_accounting',
     'manage_accounting']
  ];
  i int;
  t text;
  rarr text;
  warr text;
begin
  for i in 1 .. array_length(splits, 1) loop
    t := splits[i][1];
    -- 'a,b' -> array['a','b'] (a SQL array literal embedded into the policy).
    rarr := 'array[''' || replace(splits[i][2], ',', ''',''') || ''']';
    warr := 'array[''' || replace(splits[i][3], ',', ''',''') || ''']';
    execute format('drop policy if exists %I on %I', t || '_rls', t);
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for select using (has_any_capability(org_id, %s))',
      t || '_read', t, rarr
    );
    execute format(
      'create policy %I on %I for all using (has_any_capability(org_id, %s)) with check (has_any_capability(org_id, %s))',
      t || '_write', t, warr, warr
    );
  end loop;
end $$;

-- === 4. Single-capability re-gates (renamed keys) ===========================
-- Orion/AI tables move use_orion -> use_ai; skills move to manage_skills.
do $$
declare
  singles text[][] := array[
    ['conversations','use_ai'],
    ['messages','use_ai'],
    ['message_files','use_ai'],
    ['agent_memory','use_ai'],
    ['project_memory','use_ai'],
    ['orion_skills','manage_skills']
  ];
  i int;
  t text;
  c text;
begin
  for i in 1 .. array_length(singles, 1) loop
    t := singles[i][1];
    c := singles[i][2];
    execute format('drop policy if exists %I on %I', t || '_rls', t);
    execute format(
      'create policy %I on %I for all using (has_capability(org_id, %L)) with check (has_capability(org_id, %L))',
      t || '_rls', t, c, c
    );
  end loop;
end $$;
