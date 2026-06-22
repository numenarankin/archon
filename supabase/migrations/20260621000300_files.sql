-- 20260621000300_files.sql
-- Files & folders: one folder tree, one files table, a many-to-many placement
-- join (a file can appear in many folders without duplicating bytes), and a
-- single private storage bucket for the bytes.
--
-- No folders are seeded — the tree starts empty and you add your own.

create table folders (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  parent_folder_id uuid references folders (id) on delete cascade,
  is_system        boolean not null default false,  -- e.g. a chat-attachments folder
  created_at       timestamptz not null default now()
);
create index folders_parent_idx on folders (parent_folder_id);
alter table folders enable row level security;
create policy folders_authenticated on folders
  for all to authenticated using (true) with check (true);

create table files (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  type               text not null
    check (type in ('pdf','doc','md','note','image','transcript','url')),
  mime               text,
  size               bigint,
  -- Object key in the storage bucket. NULL for native docs whose body is inline.
  storage_key        text,
  content            text,            -- inline body for md / note types
  derived_content    text,            -- OCR / extracted text, so the AI can read binaries
  derived_at         timestamptz,
  -- Cached parsed-data summary (CSV/tabular header + column stats) as jsonb.
  structured_summary jsonb,
  uploaded_by        uuid references users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger files_set_updated_at
  before update on files
  for each row execute function set_updated_at();
alter table files enable row level security;
create policy files_authenticated on files
  for all to authenticated using (true) with check (true);

create table file_placements (
  id            uuid primary key default gen_random_uuid(),
  file_id       uuid not null references files (id) on delete cascade,
  folder_id     uuid not null references folders (id) on delete cascade,
  pinned        boolean not null default false,
  name_override text,
  created_at    timestamptz not null default now(),
  unique (file_id, folder_id)
);
create index file_placements_folder_idx on file_placements (folder_id);
create index file_placements_file_idx   on file_placements (file_id);
alter table file_placements enable row level security;
create policy file_placements_authenticated on file_placements
  for all to authenticated using (true) with check (true);

-- Private bucket for all file bytes (served via signed URLs).
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;
create policy files_bucket_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'files') with check (bucket_id = 'files');
