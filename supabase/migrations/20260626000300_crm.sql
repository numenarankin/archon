-- 20260626000300_crm.sql
-- The CRM spine: business units, durable accounts/contacts, per-unit pipelines,
-- episodic deals, and one unified activity timeline. Shared storage, split by
-- business unit (Numena vs WildcatIQ) as a hard wall in RLS.
--
-- Layering (each narrower than the last):
--   workspace_id        -> the tenant (your company)            [app_workspace_ids]
--   business_unit_id    -> the division a record belongs to     [app_business_unit_ids]
--   owner_id            -> the rep who owns it (reassignable)
-- A workspace owner/admin (or anyone with the 'crm_all_units' capability) sees
-- across both units for leadership reporting; a plain rep sees only the unit(s)
-- they're a member of. Page-level access (which CRM page a member can open) is
-- enforced separately in the app via the capability/page system.
--
-- Design notes that came out of the CRM discussion:
--   * The ACCOUNT/CONTACT is the durable record — added once, lives forever,
--     advances through `lifecycle` (lead -> prospect -> customer -> churned).
--   * A DEAL is an EPISODE attached to an account; many deals can exist over an
--     account's life, each won or lost independently. Losing a deal never kills
--     the account.
--   * `do_not_contact` is a PERMANENT flag on the record, not a status that the
--     next interaction can overwrite.
--   * Per-call outcomes live on activities; the record's stage is separate.
--   * Pipelines and stages are DATA (per unit), not hardcoded.

-- ── Business units + membership ─────────────────────────────────────────────

create table business_units (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces (id) on delete cascade,
  key                text not null check (key in ('numena', 'wildcat')),
  name               text not null,
  default_pipeline_id uuid,            -- FK added after crm_pipelines exists
  created_at         timestamptz not null default now(),
  unique (workspace_id, key)
);

-- Which unit(s) a rep works in (their territory). RLS keys off this.
create table business_unit_members (
  business_unit_id uuid not null references business_units (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null default 'rep' check (role in ('lead', 'rep')),
  created_at       timestamptz not null default now(),
  primary key (business_unit_id, user_id)
);
create index business_unit_members_user_idx on business_unit_members (user_id);

-- Helper: the business units the caller belongs to. SECURITY DEFINER so it reads
-- membership without RLS (no recursion when used inside policies). Mirrors
-- app_workspace_ids().
create or replace function app_business_unit_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.business_unit_id
  from public.business_unit_members m
  where m.user_id = auth.uid();
$$;
revoke execute on function app_business_unit_ids() from public, anon;
grant execute on function app_business_unit_ids() to authenticated;

alter table business_units enable row level security;
alter table business_unit_members enable row level security;

-- Members of the workspace can read the unit list (names aren't sensitive);
-- units are created via the service-role client during provisioning.
create policy business_units_select on business_units
  for select to authenticated
  using (workspace_id in (select app_workspace_ids()));

-- A rep can see the roster of units they belong to.
create policy business_unit_members_select on business_unit_members
  for select to authenticated
  using (business_unit_id in (select app_business_unit_ids()));

-- ── Accounts (durable companies) ────────────────────────────────────────────

create table crm_accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  business_unit_id uuid not null references business_units (id),
  owner_id         uuid default auth.uid() references auth.users (id) on delete set null,
  name             text not null,
  kind             text,             -- 'operator' | 'issuer' | 'investor' | 'firm' | ...
  lifecycle        text not null default 'lead'
                     check (lifecycle in ('lead', 'prospect', 'customer', 'churned')),
  website          text,
  phone            text,
  address          text,
  do_not_contact   boolean not null default false,   -- permanent suppression flag
  -- Link back to existing intel WITHOUT copying it.
  source_kind      text,             -- 'rrc_operator' | 'formd_issuer' | 'investor' | null
  source_ref       text,             -- operator_number / CIK / external id
  custom           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index crm_accounts_unit_idx on crm_accounts (business_unit_id, lifecycle);
create index crm_accounts_owner_idx on crm_accounts (owner_id);
create index crm_accounts_source_idx on crm_accounts (source_kind, source_ref);
create trigger crm_accounts_set_updated_at
  before update on crm_accounts for each row execute function set_updated_at();

alter table crm_accounts enable row level security;
create policy crm_accounts_rw on crm_accounts
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- ── Contacts (durable people) ───────────────────────────────────────────────

create table crm_contacts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  business_unit_id uuid not null references business_units (id),
  account_id       uuid references crm_accounts (id) on delete set null,
  owner_id         uuid default auth.uid() references auth.users (id) on delete set null,
  name             text not null,
  title            text,
  email            text,
  phone            text,
  do_not_contact   boolean not null default false,
  source_kind      text,
  source_ref       text,
  custom           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index crm_contacts_account_idx on crm_contacts (account_id);
create index crm_contacts_unit_idx on crm_contacts (business_unit_id);
create index crm_contacts_email_idx on crm_contacts (lower(email));
create trigger crm_contacts_set_updated_at
  before update on crm_contacts for each row execute function set_updated_at();

alter table crm_contacts enable row level security;
create policy crm_contacts_rw on crm_contacts
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- ── Pipelines + stages (per unit, configurable) ─────────────────────────────

create table crm_pipelines (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  business_unit_id uuid not null references business_units (id),
  name             text not null,
  is_default       boolean not null default false,
  sort_order       numeric not null default 0,
  created_at       timestamptz not null default now()
);
create index crm_pipelines_unit_idx on crm_pipelines (business_unit_id);

create table crm_pipeline_stages (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  business_unit_id uuid not null references business_units (id),
  pipeline_id      uuid not null references crm_pipelines (id) on delete cascade,
  name             text not null,
  sort_order       numeric not null default 0,
  probability      int,                                   -- default win-likelihood %
  is_won           boolean not null default false,
  is_lost          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index crm_pipeline_stages_pipeline_idx on crm_pipeline_stages (pipeline_id, sort_order);

alter table crm_pipelines enable row level security;
alter table crm_pipeline_stages enable row level security;
create policy crm_pipelines_rw on crm_pipelines
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));
create policy crm_pipeline_stages_rw on crm_pipeline_stages
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- Now the business_units default-pipeline FK can be added.
alter table business_units
  add constraint business_units_default_pipeline_fkey
  foreign key (default_pipeline_id) references crm_pipelines (id) on delete set null;

-- ── Deals (episodic opportunities) ──────────────────────────────────────────

create table crm_deals (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null default app_default_workspace_id()
                       references workspaces (id) on delete cascade,
  business_unit_id   uuid not null references business_units (id),
  pipeline_id        uuid not null references crm_pipelines (id),
  stage_id           uuid not null references crm_pipeline_stages (id),
  account_id         uuid references crm_accounts (id) on delete set null,
  primary_contact_id uuid references crm_contacts (id) on delete set null,
  owner_id           uuid default auth.uid() references auth.users (id) on delete set null,
  name               text not null,
  amount             numeric,
  currency           text not null default 'USD',
  close_date         date,
  probability        int,
  status             text not null default 'open'
                       check (status in ('open', 'won', 'lost')),
  lost_reason        text,
  custom             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index crm_deals_unit_status_idx on crm_deals (business_unit_id, status);
create index crm_deals_stage_idx on crm_deals (pipeline_id, stage_id);
create index crm_deals_account_idx on crm_deals (account_id);
create index crm_deals_owner_idx on crm_deals (owner_id);
create trigger crm_deals_set_updated_at
  before update on crm_deals for each row execute function set_updated_at();

alter table crm_deals enable row level security;
create policy crm_deals_rw on crm_deals
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- Buying committee: the people involved in a deal (beyond the primary contact).
create table crm_deal_contacts (
  deal_id    uuid not null references crm_deals (id) on delete cascade,
  contact_id uuid not null references crm_contacts (id) on delete cascade,
  role       text,
  created_at timestamptz not null default now(),
  primary key (deal_id, contact_id)
);
alter table crm_deal_contacts enable row level security;
-- Gated through the parent deal's visibility.
create policy crm_deal_contacts_rw on crm_deal_contacts
  for all to authenticated
  using (exists (select 1 from crm_deals d where d.id = crm_deal_contacts.deal_id))
  with check (exists (select 1 from crm_deals d where d.id = crm_deal_contacts.deal_id));

-- ── Activities (the unified timeline) ───────────────────────────────────────
-- One log for calls, emails, meetings, notes, and tasks. Any activity can hang
-- off an account, a contact, and/or a deal. The sales desk's calls + follow-ups
-- fold in here later (type='call' / 'meeting' / 'email').

create table crm_activities (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default app_default_workspace_id()
                     references workspaces (id) on delete cascade,
  business_unit_id uuid not null references business_units (id),
  type             text not null
                     check (type in ('call', 'email', 'meeting', 'note', 'task')),
  account_id       uuid references crm_accounts (id) on delete cascade,
  contact_id       uuid references crm_contacts (id) on delete cascade,
  deal_id          uuid references crm_deals (id) on delete cascade,
  owner_id         uuid default auth.uid() references auth.users (id) on delete set null,
  subject          text,
  body             text,
  occurred_at      timestamptz not null default now(),   -- when it happened
  due_at           timestamptz,                           -- for type='task'
  completed_at     timestamptz,                           -- for type='task'
  -- Type-specific extras: call {duration, outcome, recording_url, transcript_id};
  -- email {direction, opened, clicked}; meeting {calendar_event_id, meet_link}.
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index crm_activities_account_idx on crm_activities (account_id, occurred_at desc);
create index crm_activities_contact_idx on crm_activities (contact_id, occurred_at desc);
create index crm_activities_deal_idx on crm_activities (deal_id, occurred_at desc);
create index crm_activities_unit_idx on crm_activities (business_unit_id, occurred_at desc);
create index crm_activities_open_tasks_idx
  on crm_activities (owner_id, due_at) where type = 'task' and completed_at is null;
create trigger crm_activities_set_updated_at
  before update on crm_activities for each row execute function set_updated_at();

alter table crm_activities enable row level security;
create policy crm_activities_rw on crm_activities
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- ── Seed: the two business units + a default pipeline each ───────────────────
-- Runs as the migration role (bypasses RLS), so it provisions cleanly. The
-- founder is made a 'lead' of both units. Idempotent on re-run.

do $$
declare
  ws        uuid;
  founder   uuid;
  bu_numena uuid;
  bu_wild   uuid;
  pipe      uuid;
begin
  select id into ws from public.workspaces order by created_at asc limit 1;
  if ws is null then
    raise log 'crm seed: no workspace found, skipping';
    return;
  end if;
  select user_id into founder
  from public.workspace_members
  where workspace_id = ws and role = 'owner'
  order by created_at asc limit 1;

  insert into public.business_units (workspace_id, key, name)
  values (ws, 'numena', 'Numena'), (ws, 'wildcat', 'WildcatIQ')
  on conflict (workspace_id, key) do nothing;

  select id into bu_numena from public.business_units where workspace_id = ws and key = 'numena';
  select id into bu_wild   from public.business_units where workspace_id = ws and key = 'wildcat';

  if founder is not null then
    insert into public.business_unit_members (business_unit_id, user_id, role)
    values (bu_numena, founder, 'lead'), (bu_wild, founder, 'lead')
    on conflict do nothing;
  end if;

  -- Numena default pipeline.
  if not exists (select 1 from public.crm_pipelines where business_unit_id = bu_numena) then
    insert into public.crm_pipelines (workspace_id, business_unit_id, name, is_default)
    values (ws, bu_numena, 'Sales', true) returning id into pipe;
    insert into public.crm_pipeline_stages
      (workspace_id, business_unit_id, pipeline_id, name, sort_order, probability, is_won, is_lost)
    values
      (ws, bu_numena, pipe, 'Lead',        1, 10,  false, false),
      (ws, bu_numena, pipe, 'Qualified',   2, 25,  false, false),
      (ws, bu_numena, pipe, 'Pilot',       3, 50,  false, false),
      (ws, bu_numena, pipe, 'Contract',    4, 75,  false, false),
      (ws, bu_numena, pipe, 'Closed Won',  5, 100, true,  false),
      (ws, bu_numena, pipe, 'Closed Lost', 6, 0,   false, true);
    update public.business_units set default_pipeline_id = pipe where id = bu_numena;
  end if;

  -- WildcatIQ default pipeline (mirrors the cold-call lifecycle).
  if not exists (select 1 from public.crm_pipelines where business_unit_id = bu_wild) then
    insert into public.crm_pipelines (workspace_id, business_unit_id, name, is_default)
    values (ws, bu_wild, 'Outreach', true) returning id into pipe;
    insert into public.crm_pipeline_stages
      (workspace_id, business_unit_id, pipeline_id, name, sort_order, probability, is_won, is_lost)
    values
      (ws, bu_wild, pipe, 'Cold',        1, 5,   false, false),
      (ws, bu_wild, pipe, 'Connected',   2, 20,  false, false),
      (ws, bu_wild, pipe, 'Meeting',     3, 40,  false, false),
      (ws, bu_wild, pipe, 'Proposal',    4, 65,  false, false),
      (ws, bu_wild, pipe, 'Closed Won',  5, 100, true,  false),
      (ws, bu_wild, pipe, 'Closed Lost', 6, 0,   false, true);
    update public.business_units set default_pipeline_id = pipe where id = bu_wild;
  end if;
end $$;
