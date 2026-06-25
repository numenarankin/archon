-- 20260625001000_resource_acl.sql
-- Per-resource ownership + sharing (Google Drive style) for files, folders, and
-- their knowledge-graph dependents. Replaces the whole-workspace sharing from
-- 20260625000400: content is now PRIVATE to its creator by default, and becomes
-- visible to others only through an explicit share (to a specific user or to the
-- whole workspace). Custom skills become per-user owned.
--
-- Visibility rules (per-file AND per-folder, finest granularity):
--   folder: you own it, OR it's shared to you / a workspace you're in.
--   file:   you own it, OR it's shared to you / your workspace, OR it sits in a
--           folder you can see (placement inheritance). No automatic
--           parent->subfolder cascade — each folder is shared independently.
--   document_chunks / file_tags / bridges inherit their file's visibility, so RAG
--   and the graph never leak a doc the caller can't open.

-- ── ownership columns (backfilled to the founder, the current sole owner) ────
alter table folders add column if not exists owner_id uuid;
alter table files   add column if not exists owner_id uuid;
alter table archon_skills add column if not exists owner_id uuid;

update folders f set owner_id = w.owner_uid
  from public.workspaces w where f.workspace_id = w.id and f.owner_id is null;
update files f set owner_id = w.owner_uid
  from public.workspaces w where f.workspace_id = w.id and f.owner_id is null;
update archon_skills s set owner_id = w.owner_uid
  from public.workspaces w where s.workspace_id = w.id and s.owner_id is null;

alter table folders
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint folders_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;
alter table files
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint files_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;
alter table archon_skills
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint archon_skills_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;

create index if not exists folders_owner_idx on folders (owner_id);
create index if not exists files_owner_idx on files (owner_id);
create index if not exists archon_skills_owner_idx on archon_skills (owner_id);

-- ── the share grants table ──────────────────────────────────────────────────
create table resource_shares (
  id            uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('file', 'folder')),
  resource_id   uuid not null,
  -- grantee_id is an auth user id (grantee_kind='user') or a workspace id
  -- (grantee_kind='workspace').
  grantee_kind  text not null check (grantee_kind in ('user', 'workspace')),
  grantee_id    uuid not null,
  can_edit      boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (resource_type, resource_id, grantee_kind, grantee_id)
);
create index resource_shares_lookup_idx on resource_shares (resource_type, resource_id);
create index resource_shares_grantee_idx on resource_shares (grantee_kind, grantee_id);

-- ── visibility / edit helpers (SECURITY DEFINER → no RLS recursion) ─────────
create or replace function app_can_see_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folders f
    where f.id = p_folder and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.resource_shares s
    where s.resource_type = 'folder' and s.resource_id = p_folder
      and ((s.grantee_kind = 'user' and s.grantee_id = auth.uid())
        or (s.grantee_kind = 'workspace' and s.grantee_id in (select public.app_workspace_ids())))
  );
$$;

create or replace function app_can_edit_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folders f
    where f.id = p_folder and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.resource_shares s
    where s.resource_type = 'folder' and s.resource_id = p_folder and s.can_edit
      and ((s.grantee_kind = 'user' and s.grantee_id = auth.uid())
        or (s.grantee_kind = 'workspace' and s.grantee_id in (select public.app_workspace_ids())))
  );
$$;

create or replace function app_can_see_file(p_file uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.resource_shares s
    where s.resource_type = 'file' and s.resource_id = p_file
      and ((s.grantee_kind = 'user' and s.grantee_id = auth.uid())
        or (s.grantee_kind = 'workspace' and s.grantee_id in (select public.app_workspace_ids())))
  ) or exists (
    select 1 from public.file_placements fp
    where fp.file_id = p_file and fp.folder_id is not null
      and public.app_can_see_folder(fp.folder_id)
  );
$$;

create or replace function app_can_edit_file(p_file uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.resource_shares s
    where s.resource_type = 'file' and s.resource_id = p_file and s.can_edit
      and ((s.grantee_kind = 'user' and s.grantee_id = auth.uid())
        or (s.grantee_kind = 'workspace' and s.grantee_id in (select public.app_workspace_ids())))
  ) or exists (
    select 1 from public.file_placements fp
    where fp.file_id = p_file and fp.folder_id is not null
      and public.app_can_edit_folder(fp.folder_id)
  );
$$;

revoke execute on function app_can_see_folder(uuid), app_can_edit_folder(uuid),
  app_can_see_file(uuid), app_can_edit_file(uuid) from public, anon;
grant execute on function app_can_see_folder(uuid), app_can_edit_folder(uuid),
  app_can_see_file(uuid), app_can_edit_file(uuid) to authenticated;

-- ── folders RLS ─────────────────────────────────────────────────────────────
drop policy if exists folders_workspace on folders;
create policy folders_select on folders for select to authenticated
  using (app_can_see_folder(id));
create policy folders_insert on folders for insert to authenticated
  with check (owner_id = auth.uid());
create policy folders_update on folders for update to authenticated
  using (app_can_edit_folder(id)) with check (app_can_edit_folder(id));
create policy folders_delete on folders for delete to authenticated
  using (owner_id = auth.uid());

-- ── files RLS ───────────────────────────────────────────────────────────────
drop policy if exists files_workspace on files;
create policy files_select on files for select to authenticated
  using (app_can_see_file(id));
create policy files_insert on files for insert to authenticated
  with check (owner_id = auth.uid());
create policy files_update on files for update to authenticated
  using (app_can_edit_file(id)) with check (app_can_edit_file(id));
create policy files_delete on files for delete to authenticated
  using (owner_id = auth.uid());

-- ── file_placements: gated by the file's access ─────────────────────────────
drop policy if exists file_placements_workspace on file_placements;
create policy file_placements_select on file_placements for select to authenticated
  using (app_can_see_file(file_id));
create policy file_placements_write on file_placements for all to authenticated
  using (app_can_edit_file(file_id)) with check (app_can_edit_file(file_id));

-- ── document_chunks / file_tags / bridges: inherit file visibility ──────────
drop policy if exists document_chunks_workspace on document_chunks;
create policy document_chunks_select on document_chunks for select to authenticated
  using (app_can_see_file(file_id));
create policy document_chunks_write on document_chunks for all to authenticated
  using (app_can_edit_file(file_id)) with check (app_can_edit_file(file_id));

drop policy if exists file_tags_workspace on file_tags;
create policy file_tags_select on file_tags for select to authenticated
  using (app_can_see_file(file_id));
create policy file_tags_write on file_tags for all to authenticated
  using (app_can_edit_file(file_id)) with check (app_can_edit_file(file_id));

drop policy if exists bridges_workspace on bridges;
create policy bridges_select on bridges for select to authenticated
  using (app_can_see_file(source_file_id));
create policy bridges_write on bridges for all to authenticated
  using (app_can_edit_file(source_file_id)) with check (app_can_edit_file(source_file_id));

-- ── project_memory: inherit folder visibility ───────────────────────────────
drop policy if exists project_memory_workspace on project_memory;
create policy project_memory_select on project_memory for select to authenticated
  using (app_can_see_folder(folder_id));
create policy project_memory_write on project_memory for all to authenticated
  using (app_can_edit_folder(folder_id)) with check (app_can_edit_folder(folder_id));

-- ── archon_skills: per-user owned, no admin approval ────────────────────────
drop policy if exists archon_skills_select on archon_skills;
drop policy if exists archon_skills_admin_write on archon_skills;
create policy archon_skills_owner on archon_skills for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── resource_shares RLS: manage shares on resources you can edit ────────────
alter table resource_shares enable row level security;
-- See a share if it grants you/your workspace, or you can edit the resource.
create policy resource_shares_select on resource_shares for select to authenticated
  using (
    (grantee_kind = 'user' and grantee_id = auth.uid())
    or (grantee_kind = 'workspace' and grantee_id in (select app_workspace_ids()))
    or (resource_type = 'file'   and app_can_edit_file(resource_id))
    or (resource_type = 'folder' and app_can_edit_folder(resource_id))
  );
-- Create/revoke a share only on a resource you can edit.
create policy resource_shares_write on resource_shares for all to authenticated
  using (
    (resource_type = 'file'   and app_can_edit_file(resource_id))
    or (resource_type = 'folder' and app_can_edit_folder(resource_id))
  )
  with check (
    (resource_type = 'file'   and app_can_edit_file(resource_id))
    or (resource_type = 'folder' and app_can_edit_folder(resource_id))
  );
