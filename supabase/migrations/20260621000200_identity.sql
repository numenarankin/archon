-- 20260621000200_identity.sql
-- Identity + profile.
--
-- `users` is the row that file uploaders, conversation owners, and memory rows
-- can point at. It is optional (every FK to it is nullable) — single-user
-- installs can leave it empty. `profile` is a singleton (one row) holding the
-- signed-in user's display name, phone, and avatar, edited on Settings.

create table users (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  initials   text,
  email      text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table users enable row level security;
create policy users_authenticated on users
  for all to authenticated using (true) with check (true);

create table profile (
  id         boolean primary key default true check (id),  -- singleton: one row
  name       text not null default '',
  phone      text,
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table profile enable row level security;
create policy profile_authenticated on profile
  for all to authenticated using (true) with check (true);

create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();

-- Seed the single profile row so updates can upsert against a known key.
insert into profile (id, name) values (true, '')
on conflict (id) do nothing;

-- Public bucket for avatars (shown via a plain URL in the app shell).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy avatars_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
