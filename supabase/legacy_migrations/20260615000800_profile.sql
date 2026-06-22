-- 20260615000800_profile.sql
-- The signed-in user's profile / workspace identity, edited on the Settings
-- page. Prototype-era: one workspace, so this is a SINGLETON table — the
-- `id boolean` check pins it to exactly one row. When real auth lands this
-- becomes a per-user row keyed by users.id.

create table profile (
  id           boolean primary key default true check (id),
  name         text not null default '',
  company_name text not null default '',
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();

-- Seed the single row so updates can upsert against a known key.
insert into profile (id, name, company_name)
values (true, '', '')
on conflict (id) do nothing;

-- Public bucket for avatars: profile pictures are shown in the app shell via a
-- plain URL, so unlike the private `files` bucket this one is public-read.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
