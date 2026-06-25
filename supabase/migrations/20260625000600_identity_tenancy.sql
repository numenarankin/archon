-- 20260625000600_identity_tenancy.sql
-- Phase 3d: per-user identity. profile and integration_settings were boolean
-- singletons (one row for "the" user); both become keyed by the auth user.
--   • profile              -> per-user display name/phone/avatar (owner-scoped RLS)
--   • integration_settings -> per-user Google OAuth secrets (service-role only)
--   • users                -> tightened from "any authenticated reads all" to own row
--
-- COUPLED APP CHANGES (Phase 4): profile reads/writes must key on user_id
-- (on conflict user_id); integration_settings reads/writes (service-role) must
-- filter/insert owner_id. The cross-member roster keeps using the admin client.

-- ── profile: singleton -> per-user ──────────────────────────────────────────
alter table profile add column if not exists user_id uuid;
update profile set user_id =
  (select m.user_id from public.workspace_members m
   where m.role = 'owner' order by m.created_at asc limit 1)
  where user_id is null;
alter table profile drop constraint if exists profile_pkey;
alter table profile drop column if exists id;     -- removes the singleton boolean + its check
alter table profile
  alter column user_id set default auth.uid(),
  alter column user_id set not null,
  add constraint profile_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  add constraint profile_pkey primary key (user_id);

drop policy if exists profile_authenticated on profile;
create policy profile_owner on profile
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── integration_settings: singleton -> per-user (still service-role only) ────
alter table integration_settings add column if not exists owner_id uuid;
update integration_settings set owner_id =
  (select m.user_id from public.workspace_members m
   where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;
alter table integration_settings drop constraint if exists integration_settings_pkey;
alter table integration_settings drop column if exists id;
alter table integration_settings
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint integration_settings_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade,
  add constraint integration_settings_pkey primary key (owner_id);
-- Intentionally still NO authenticated policy: secrets stay service-role only.
-- RLS remains enabled; the admin client must now filter by owner_id.

-- ── users: own row only ─────────────────────────────────────────────────────
-- Was "any authenticated reads/writes all". Provisioning and the member roster
-- run through the service-role client, so authenticated only needs its own row.
drop policy if exists users_authenticated on users;
create policy users_self on users
  for all to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());
