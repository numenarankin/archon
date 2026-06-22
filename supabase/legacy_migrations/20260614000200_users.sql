-- 20260614000200_users.sql
-- Application users. One identity behind comment authors, task assignees,
-- file uploaders, and conversation owners.
--
-- `auth_id` links to Supabase Auth once it exists; it is nullable so people can
-- be seeded now (before auth) and linked later.

create table users (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  initials   text,
  email      text unique,
  role       text,
  avatar_url text,
  created_at timestamptz not null default now()
);
