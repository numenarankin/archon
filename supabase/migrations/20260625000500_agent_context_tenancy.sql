-- 20260625000500_agent_context_tenancy.sql
-- Phase 3b: make Archon's context docs per-user. Each user gets their own soul /
-- app / harness / skills / memory / persona, so the agent is personalized and one
-- user's self-edits never touch another's prompt.
--
-- The docs were singletons keyed by doc_type. We:
--   1. snapshot the current 6 docs into a templates table (defaults for new users),
--   2. add owner_id to docs + revisions and stamp existing rows to the founder,
--   3. re-key docs PK to (owner_id, doc_type) and re-point the revisions FK,
--   4. update the revision-logging trigger to carry owner_id,
--   5. owner-scope RLS,
--   6. add seed_agent_context(owner) for provisioning new users.
--
-- COUPLED APP CHANGES (Phase 4): loadContextDocs / reflection upserts must use
-- `on conflict (owner_id, doc_type)` and rely on owner_id defaulting to auth.uid().

-- 1. Template table: pristine defaults copied from today's system docs ----------
create table agent_context_templates (
  doc_type   text primary key
    check (doc_type in ('soul', 'app', 'harness', 'skills', 'memory', 'persona')),
  content    text not null default '',
  updated_at timestamptz not null default now()
);
alter table agent_context_templates enable row level security;
-- Read-only reference for all authenticated users; writes via service role only.
create policy agent_context_templates_select on agent_context_templates
  for select to authenticated using (true);

insert into agent_context_templates (doc_type, content)
select doc_type, content from agent_context_docs
on conflict (doc_type) do nothing;

-- 2. owner_id on docs + revisions, stamped to the founder ----------------------
alter table agent_context_docs add column if not exists owner_id uuid;
update agent_context_docs set owner_id =
  (select m.user_id from public.workspace_members m
   where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;

alter table agent_context_revisions add column if not exists owner_id uuid;
update agent_context_revisions set owner_id =
  (select m.user_id from public.workspace_members m
   where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;

-- 3. Re-key docs PK and re-point the revisions FK ------------------------------
-- Drop the dependent FK first, then swap the primary key.
alter table agent_context_revisions
  drop constraint if exists agent_context_revisions_doc_type_fkey;
alter table agent_context_docs
  drop constraint if exists agent_context_docs_pkey;
alter table agent_context_docs
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint agent_context_docs_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade,
  add constraint agent_context_docs_pkey primary key (owner_id, doc_type);

alter table agent_context_revisions
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint agent_context_revisions_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade,
  add constraint agent_context_revisions_doc_fkey
    foreign key (owner_id, doc_type)
    references agent_context_docs (owner_id, doc_type) on delete cascade;

-- 4. Revision-logging trigger now carries owner_id ----------------------------
create or replace function log_context_revision()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
    return new;  -- no content change, nothing to log
  end if;
  insert into agent_context_revisions (owner_id, doc_type, version, content, updated_by, rationale)
  values (new.owner_id, new.doc_type, new.version, new.content, new.updated_by, new.last_edit_rationale);
  return new;
end;
$$;
-- bump_context_version() is unchanged (operates on the row in place).

-- 5. Owner-scoped RLS ----------------------------------------------------------
drop policy if exists agent_context_docs_authenticated on agent_context_docs;
create policy agent_context_docs_owner on agent_context_docs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists agent_context_revisions_authenticated on agent_context_revisions;
create policy agent_context_revisions_owner on agent_context_revisions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 6. Seed helper for provisioning a new user's docs from the templates ---------
create or replace function seed_agent_context(p_owner uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.agent_context_docs (owner_id, doc_type, content, updated_by)
  select p_owner, t.doc_type, t.content, 'system'
  from public.agent_context_templates t
  on conflict (owner_id, doc_type) do nothing;
$$;
revoke execute on function seed_agent_context(uuid) from public, anon;
grant execute on function seed_agent_context(uuid) to authenticated, service_role;
