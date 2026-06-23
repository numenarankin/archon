-- 20260623000000_knowledge_graph.sql
-- Knowledge graph: cross-document citations ("bridges") + topic tags.
--
-- Bridges are directed citations from one document to another, created either
-- inline with @-mentions or via footnotes in the editor. Tags label a file with
-- a topic area. Both can be created by a person or, on explicit request, by the
-- AI — `created_by` records which, so AI-added connections can be audited.
--
-- RLS mirrors the files tables: any authenticated user may read/write (org
-- scoping is enforced upstream of these tables, as with files/folders).

create table bridges (
  id             uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references files (id) on delete cascade,
  target_file_id uuid not null references files (id) on delete cascade,
  -- 'cite' = inline @-mention; 'footnote' = footnote reference.
  kind           text not null default 'cite' check (kind in ('cite', 'footnote')),
  -- Stable marker id of the inline span / footnote in the source body, so the
  -- editor can anchor the citation and reconciliation can de-duplicate.
  anchor         text,
  note           text,            -- optional footnote text
  created_by     text not null default 'user' check (created_by in ('user', 'ai')),
  created_at     timestamptz not null default now(),
  -- A source may cite the same target from several distinct anchors.
  unique (source_file_id, target_file_id, anchor)
);
create index bridges_source_idx on bridges (source_file_id);
create index bridges_target_idx on bridges (target_file_id);
-- A document can't bridge to itself.
alter table bridges add constraint bridges_no_self_cite
  check (source_file_id <> target_file_id);
alter table bridges enable row level security;
create policy bridges_authenticated on bridges
  for all to authenticated using (true) with check (true);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,   -- normalized key so @royalties === "Royalties"
  created_at timestamptz not null default now()
);
alter table tags enable row level security;
create policy tags_authenticated on tags
  for all to authenticated using (true) with check (true);

create table file_tags (
  file_id    uuid not null references files (id) on delete cascade,
  tag_id     uuid not null references tags (id) on delete cascade,
  created_by text not null default 'user' check (created_by in ('user', 'ai')),
  created_at timestamptz not null default now(),
  primary key (file_id, tag_id)
);
create index file_tags_tag_idx  on file_tags (tag_id);
create index file_tags_file_idx on file_tags (file_id);
alter table file_tags enable row level security;
create policy file_tags_authenticated on file_tags
  for all to authenticated using (true) with check (true);
