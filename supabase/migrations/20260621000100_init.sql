-- 20260621000100_init.sql
-- Foundation: extensions, the enums the app actually uses, and the shared
-- updated_at trigger helper.
--
-- Auth model: this app has no organizations or per-feature roles. Any
-- authenticated account has full access; Row Level Security is enabled on every
-- table with a single `to authenticated` policy (see each table's migration).
-- A signed-out request (the `anon` role) gets nothing.

-- Extensions ---------------------------------------------------------------
create extension if not exists vector;   -- pgvector — embeddings for RAG + memory
create extension if not exists pg_trgm;  -- trigram fuzzy text matching

-- Enums --------------------------------------------------------------------
create type task_status   as enum ('planned', 'priority', 'doing', 'done');
create type task_priority as enum ('Low', 'Medium', 'High');
create type message_role  as enum ('system', 'user', 'assistant');

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
