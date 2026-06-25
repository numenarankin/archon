-- 20260625000200_tenancy_backfill.sql
-- One-time provisioning of the founder workspace for data that predates
-- multi-tenancy. The app has had a single real user, rankin@wildcatiq.ai; all
-- existing rows (files, chats, memory, tasks, profile, ...) belong to them.
--
-- This migration creates exactly one workspace, makes the founder its owner, and
-- grants the reference-data entitlements. The PER-ROW stamping of owner_id /
-- workspace_id happens in the Phase 3 per-domain migrations (after those columns
-- exist), each reading back this single workspace/owner. Idempotent: re-running
-- is a no-op once the founder already owns a workspace.

do $$
declare
  founder_id uuid;
  ws_id      uuid;
begin
  -- Resolve the founder's auth account. Fail loudly if it is missing so we never
  -- create an ownerless workspace that later backfills would attach data to.
  select id into founder_id
  from auth.users
  where lower(email) = lower('rankin@wildcatiq.ai')
  order by created_at asc
  limit 1;

  if founder_id is null then
    raise exception
      'tenancy_backfill: no auth.users row for rankin@wildcatiq.ai — fix the email or create the account before running this migration';
  end if;

  -- Idempotency: if the founder already owns a workspace, do nothing.
  select m.workspace_id into ws_id
  from public.workspace_members m
  where m.user_id = founder_id and m.role = 'owner'
  order by m.created_at asc
  limit 1;

  if ws_id is null then
    insert into public.workspaces (name)
    values ('Wildcat')
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, founder_id, 'owner');
  end if;

  -- Grant reference-data entitlements (idempotent).
  insert into public.workspace_entitlements (workspace_id, feature)
  values (ws_id, 'rrc_data'), (ws_id, 'enrichment')
  on conflict (workspace_id, feature) do nothing;

  raise log 'tenancy_backfill: founder % owns workspace %', founder_id, ws_id;
end;
$$;
