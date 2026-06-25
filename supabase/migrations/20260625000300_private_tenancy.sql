-- 20260625000300_private_tenancy.sql
-- Phase 3a: user-private tables. These stay private to their owner even when a
-- workspace later has multiple members: chat transcripts, agent memory, and the
-- personal budget ledger.
--
-- Ownership key is the auth user id (= auth.uid()). Existing rows are stamped to
-- the founder (the sole owner member created in 20260625000200). New rows default
-- owner to auth.uid(); the RLS policy both restricts reads and forbids writing a
-- row you would not own. Child tables (messages) reach ownership through their
-- parent to avoid a redundant column.
--
-- NOTE: tables that already had a nullable owner column pointing at the now-empty
-- public.users (conversations.owner_id, agent_memory.user_id) are repurposed to
-- reference auth.users so the value equals auth.uid().

-- Reusable founder lookup: the single owner member that 20260625000200 created.
-- (Inlined as a subquery below; there is exactly one such row at backfill time.)

-- ── conversations + messages ────────────────────────────────────────────────
alter table conversations drop constraint if exists conversations_owner_id_fkey;
update conversations
  set owner_id = (
    select m.user_id from public.workspace_members m
    where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;
alter table conversations
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint conversations_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;
create index if not exists conversations_owner_idx on conversations (owner_id);

drop policy if exists conversations_authenticated on conversations;
create policy conversations_owner on conversations
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- messages inherit scope from their conversation.
drop policy if exists messages_authenticated on messages;
create policy messages_owner on messages
  for all to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id and c.owner_id = auth.uid()))
  with check (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id and c.owner_id = auth.uid()));

-- ── agent_memory ────────────────────────────────────────────────────────────
-- Repurpose user_id to the auth user. Fixes the match_agent_memory cross-user
-- leak automatically: that RPC is security invoker, so RLS now scopes it.
alter table agent_memory drop constraint if exists agent_memory_user_id_fkey;
update agent_memory
  set user_id = (
    select m.user_id from public.workspace_members m
    where m.role = 'owner' order by m.created_at asc limit 1)
  where user_id is null;
alter table agent_memory
  alter column user_id set default auth.uid(),
  alter column user_id set not null,
  add constraint agent_memory_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

drop policy if exists agent_memory_authenticated on agent_memory;
create policy agent_memory_owner on agent_memory
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── budget_uploads + budget_transactions ────────────────────────────────────
-- Both get their own owner_id: a manual transaction has no upload parent, so it
-- cannot inherit scope.
alter table budget_uploads add column if not exists owner_id uuid;
update budget_uploads
  set owner_id = (
    select m.user_id from public.workspace_members m
    where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;
alter table budget_uploads
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint budget_uploads_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;

drop policy if exists budget_uploads_authenticated on budget_uploads;
create policy budget_uploads_owner on budget_uploads
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table budget_transactions add column if not exists owner_id uuid;
update budget_transactions
  set owner_id = (
    select m.user_id from public.workspace_members m
    where m.role = 'owner' order by m.created_at asc limit 1)
  where owner_id is null;
alter table budget_transactions
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint budget_transactions_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;
create index if not exists budget_transactions_owner_idx on budget_transactions (owner_id);

drop policy if exists budget_transactions_authenticated on budget_transactions;
create policy budget_transactions_owner on budget_transactions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
