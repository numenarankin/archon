-- 20260614000100_init.sql
-- Extensions, enum types, and shared helpers.
--
-- NOTE: Row Level Security is intentionally left DISABLED in these migrations
-- (prototype). Once Supabase Auth is wired up, enable RLS on every table and
-- add per-user / per-org policies before going to production.

-- Extensions ---------------------------------------------------------------
create extension if not exists vector;    -- pgvector, for RAG (document_chunks)
create extension if not exists pg_trgm;   -- fuzzy name matching (optional)

-- Enum types ---------------------------------------------------------------
create type equipment_status as enum ('Operational', 'Maintenance', 'Down');
create type person_status     as enum ('Active', 'Inactive');
create type interest_type     as enum ('Royalty', 'Overriding', 'Mineral');
create type task_status       as enum ('planned', 'priority', 'doing', 'done');
create type task_priority     as enum ('Low', 'Medium', 'High');
create type message_role      as enum ('system', 'user', 'assistant');

-- updated_at helper --------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
