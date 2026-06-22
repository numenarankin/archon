-- 2026061600500_well_comment_author.sql
-- Record who wrote each well comment. Until now `addComment` stored author_id =
-- null (a leftover from before auth), so every comment rendered as "Unknown".
-- The `users` directory table is never populated for real auth accounts, so
-- author_id can't be relied on; instead we denormalize the author's display
-- name (from their profile) and keep their auth user id as the durable link.
--
-- Append-only + idempotent.

alter table well_comments add column if not exists author_name text;
alter table well_comments
  add column if not exists author_auth_id uuid references auth.users (id) on delete set null;

create index if not exists well_comments_author_auth_idx
  on well_comments (author_auth_id);
