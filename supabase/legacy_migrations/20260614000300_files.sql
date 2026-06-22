-- 20260614000300_files.sql
-- Unified file model: one folder tree, one files table, a many-to-many
-- placement join (the "hardlink"), and a single storage bucket.

-- Folder tree --------------------------------------------------------------
create table folders (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  parent_folder_id uuid references folders (id) on delete cascade,
  is_system        boolean not null default false,  -- e.g. Chat Attachments
  created_at       timestamptz not null default now()
);
create index folders_parent_idx on folders (parent_folder_id);

-- Files (one row per real document) ----------------------------------------
create table files (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null
    check (type in ('pdf','doc','md','note','image','transcript','url')),
  mime            text,
  size            bigint,
  -- Object key in the storage bucket (file id or content hash). NULL for
  -- native docs whose body lives inline in `content`.
  storage_key     text,
  -- Inline body for native types (md / note). Replaces a document_content table.
  content         text,
  -- OCR / extracted text for binaries, so Orion can read any file.
  derived_content text,
  derived_at      timestamptz,
  uploaded_by     uuid references users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger files_set_updated_at
  before update on files
  for each row execute function set_updated_at();

-- Placements: a file appears in N folders without duplicating bytes ---------
create table file_placements (
  id            uuid primary key default gen_random_uuid(),
  file_id       uuid not null references files (id) on delete cascade,
  folder_id     uuid not null references folders (id) on delete cascade,
  pinned        boolean not null default false,  -- per-folder pin
  name_override text,                            -- optional per-placement name
  created_at    timestamptz not null default now(),
  unique (file_id, folder_id)
);
create index file_placements_folder_idx on file_placements (folder_id);
create index file_placements_file_idx   on file_placements (file_id);

-- Single storage bucket for all file bytes ---------------------------------
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;
