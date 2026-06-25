-- 20260625000400_shared_tenancy.sql
-- Phase 3c: org-shared tables. Visible to every member of the workspace that
-- owns the row (today one member == the founder). Parent tables carry
-- workspace_id; child tables reach scope through their parent FK.
--
-- Parents stamped + columned: folders, files, tasks, archon_skills, tags.
-- Children scoped via parent: file_placements, document_chunks, task_files,
-- bridges, file_tags, project_memory.
--
-- Founder workspace (the only one at backfill time):
--   (select id from public.workspaces order by created_at asc limit 1)

-- ── folders ─────────────────────────────────────────────────────────────────
alter table folders add column if not exists workspace_id uuid;
update folders set workspace_id =
  (select id from public.workspaces order by created_at asc limit 1)
  where workspace_id is null;
alter table folders
  alter column workspace_id set default app_default_workspace_id(),
  alter column workspace_id set not null,
  add constraint folders_workspace_id_fkey
    foreign key (workspace_id) references workspaces (id) on delete cascade;
create index if not exists folders_workspace_idx on folders (workspace_id);

drop policy if exists folders_authenticated on folders;
create policy folders_workspace on folders
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- ── files ───────────────────────────────────────────────────────────────────
-- uploaded_by stays as informational provenance (who uploaded); tenancy is the
-- new workspace_id.
alter table files add column if not exists workspace_id uuid;
update files set workspace_id =
  (select id from public.workspaces order by created_at asc limit 1)
  where workspace_id is null;
alter table files
  alter column workspace_id set default app_default_workspace_id(),
  alter column workspace_id set not null,
  add constraint files_workspace_id_fkey
    foreign key (workspace_id) references workspaces (id) on delete cascade;
create index if not exists files_workspace_idx on files (workspace_id);

drop policy if exists files_authenticated on files;
create policy files_workspace on files
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- file_placements → files
drop policy if exists file_placements_authenticated on file_placements;
create policy file_placements_workspace on file_placements
  for all to authenticated
  using (exists (
    select 1 from files f
    where f.id = file_placements.file_id
      and f.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from files f
    where f.id = file_placements.file_id
      and f.workspace_id in (select app_workspace_ids())));

-- document_chunks → files (also re-scopes match_document_chunks, an invoker RPC)
drop policy if exists document_chunks_authenticated on document_chunks;
create policy document_chunks_workspace on document_chunks
  for all to authenticated
  using (exists (
    select 1 from files f
    where f.id = document_chunks.file_id
      and f.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from files f
    where f.id = document_chunks.file_id
      and f.workspace_id in (select app_workspace_ids())));

-- ── tasks ───────────────────────────────────────────────────────────────────
alter table tasks add column if not exists workspace_id uuid;
update tasks set workspace_id =
  (select id from public.workspaces order by created_at asc limit 1)
  where workspace_id is null;
alter table tasks
  alter column workspace_id set default app_default_workspace_id(),
  alter column workspace_id set not null,
  add constraint tasks_workspace_id_fkey
    foreign key (workspace_id) references workspaces (id) on delete cascade;
create index if not exists tasks_workspace_idx on tasks (workspace_id);

drop policy if exists tasks_authenticated on tasks;
create policy tasks_workspace on tasks
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- task_files → tasks. NOTE: this table had RLS enabled but ZERO policies (a bug:
-- it was unreachable via the anon client). This policy fixes that.
drop policy if exists task_files_authenticated on task_files;
create policy task_files_workspace on task_files
  for all to authenticated
  using (exists (
    select 1 from tasks t
    where t.id = task_files.task_id
      and t.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from tasks t
    where t.id = task_files.task_id
      and t.workspace_id in (select app_workspace_ids())));

-- ── archon_skills ───────────────────────────────────────────────────────────
-- Workspace-shared; only owners/admins may create/edit/disable. Members read.
alter table archon_skills add column if not exists workspace_id uuid;
update archon_skills set workspace_id =
  (select id from public.workspaces order by created_at asc limit 1)
  where workspace_id is null;
alter table archon_skills
  alter column workspace_id set default app_default_workspace_id(),
  alter column workspace_id set not null,
  add constraint archon_skills_workspace_id_fkey
    foreign key (workspace_id) references workspaces (id) on delete cascade;
create index if not exists archon_skills_workspace_idx on archon_skills (workspace_id);

drop policy if exists archon_skills_authenticated on archon_skills;
-- Members of the workspace can read the skill menu...
create policy archon_skills_select on archon_skills
  for select to authenticated
  using (workspace_id in (select app_workspace_ids()));
-- ...but only owners/admins can manage them (permissive OR with the select
-- policy means members still read, admins additionally write).
create policy archon_skills_admin_write on archon_skills
  for all to authenticated
  using (app_workspace_role(workspace_id) in ('owner', 'admin'))
  with check (app_workspace_role(workspace_id) in ('owner', 'admin'));

-- ── tags (+ file_tags, bridges) ─────────────────────────────────────────────
-- tags become workspace-scoped, so uniqueness moves from global to per-workspace.
alter table tags add column if not exists workspace_id uuid;
update tags set workspace_id =
  (select id from public.workspaces order by created_at asc limit 1)
  where workspace_id is null;
alter table tags
  alter column workspace_id set default app_default_workspace_id(),
  alter column workspace_id set not null,
  add constraint tags_workspace_id_fkey
    foreign key (workspace_id) references workspaces (id) on delete cascade;
alter table tags drop constraint if exists tags_name_key;
alter table tags drop constraint if exists tags_slug_key;
alter table tags add constraint tags_workspace_name_key unique (workspace_id, name);
alter table tags add constraint tags_workspace_slug_key unique (workspace_id, slug);

drop policy if exists tags_authenticated on tags;
create policy tags_workspace on tags
  for all to authenticated
  using (workspace_id in (select app_workspace_ids()))
  with check (workspace_id in (select app_workspace_ids()));

-- file_tags → files
drop policy if exists file_tags_authenticated on file_tags;
create policy file_tags_workspace on file_tags
  for all to authenticated
  using (exists (
    select 1 from files f
    where f.id = file_tags.file_id
      and f.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from files f
    where f.id = file_tags.file_id
      and f.workspace_id in (select app_workspace_ids())));

-- bridges → source file (target is in the same workspace by construction)
drop policy if exists bridges_authenticated on bridges;
create policy bridges_workspace on bridges
  for all to authenticated
  using (exists (
    select 1 from files f
    where f.id = bridges.source_file_id
      and f.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from files f
    where f.id = bridges.source_file_id
      and f.workspace_id in (select app_workspace_ids())));

-- ── project_memory → folders ────────────────────────────────────────────────
drop policy if exists project_memory_authenticated on project_memory;
create policy project_memory_workspace on project_memory
  for all to authenticated
  using (exists (
    select 1 from folders fo
    where fo.id = project_memory.folder_id
      and fo.workspace_id in (select app_workspace_ids())))
  with check (exists (
    select 1 from folders fo
    where fo.id = project_memory.folder_id
      and fo.workspace_id in (select app_workspace_ids())));
