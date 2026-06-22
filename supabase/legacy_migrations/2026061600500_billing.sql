-- 2026061600500_billing.sql
-- Stripe billing: tiered subscriptions, an AI-credit ledger, and referral rewards.
--
-- Model (see docs/plans/billing.md):
--   * subscriptions  — one row per org; tier sets well_cap + monthly_credits,
--     mirrors Stripe status + the current billing-period window.
--   * org_credits    — the live balance. Two counters: `free_remaining` (the
--     monthly allotment, OVERWRITTEN each billing period — no rollover) and
--     `paid_balance` (top-ups; accumulates, never reset). Spend drains free
--     first, then paid; the last call may land paid_balance negative.
--   * credit_ledger  — append-only audit trail of every grant/topup/spend.
--   * referral_rewards — records the one-month reward owed to a referrer, so it
--     is granted exactly once when the referred org first converts.
--
-- Enforcement runs through SECURITY DEFINER RPCs so the math is atomic and
-- race-safe (never read-then-write a balance in JS). `billing_add_paid` is
-- revoked from anon/authenticated — only the service-role (webhook) may add
-- paid credits. Append-only + idempotent: safe to re-run.

-- === 1. Tables ==============================================================

create table if not exists subscriptions (
  org_id                 uuid primary key references organizations (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  tier                   text not null default 'tier_1',
  status                 text not null default 'trialing',
  well_cap               int  not null default 49,
  monthly_credits        bigint not null default 0,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists org_credits (
  org_id               uuid primary key references organizations (id) on delete cascade,
  free_remaining       bigint not null default 0,
  paid_balance         bigint not null default 0,
  credits_period_start timestamptz,
  updated_at           timestamptz not null default now()
);

create table if not exists credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  delta      bigint not null,
  kind       text not null check (kind in ('grant', 'topup', 'spend', 'adjustment')),
  reason     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_org_idx on credit_ledger (org_id, created_at desc);

-- Webhook idempotency: Stripe retries deliveries, so every handler runs at most
-- once per event id. Service-role only (no RLS policies = no client access).
create table if not exists stripe_events (
  id          text primary key,
  type        text,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;

-- One reward per referred org. `referrer_org` is the org that owns the code the
-- referred org signed up with (organizations.referred_by_org).
create table if not exists referral_rewards (
  id           uuid primary key default gen_random_uuid(),
  referred_org uuid not null unique references organizations (id) on delete cascade,
  referrer_org uuid not null references organizations (id) on delete cascade,
  rewarded_at  timestamptz,
  created_at   timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

drop trigger if exists org_credits_set_updated_at on org_credits;
create trigger org_credits_set_updated_at
  before update on org_credits
  for each row execute function set_updated_at();

-- === 2. RLS =================================================================
-- Reads: any active org member. Writes happen via service-role (webhooks) or
-- the SECURITY DEFINER RPCs below, both of which bypass / are exempt from these
-- policies — so there is intentionally no user-facing write policy except the
-- owner-only escape hatch on `subscriptions`.

alter table subscriptions enable row level security;
drop policy if exists subscriptions_read on subscriptions;
create policy subscriptions_read on subscriptions for select
  using (org_id = current_org_id());
drop policy if exists subscriptions_write on subscriptions;
create policy subscriptions_write on subscriptions for all
  using (is_org_owner(org_id)) with check (is_org_owner(org_id));

alter table org_credits enable row level security;
drop policy if exists org_credits_read on org_credits;
create policy org_credits_read on org_credits for select
  using (org_id = current_org_id());

alter table credit_ledger enable row level security;
drop policy if exists credit_ledger_read on credit_ledger;
create policy credit_ledger_read on credit_ledger for select
  using (org_id = current_org_id());

alter table referral_rewards enable row level security;
drop policy if exists referral_rewards_read on referral_rewards;
create policy referral_rewards_read on referral_rewards for select
  using (is_org_owner(referrer_org) or is_org_owner(referred_org));

-- === 3. RPCs ================================================================

-- Lazily refresh the monthly free allotment for the CALLER's org. Idempotent:
-- only resets when the subscription has rolled into a new billing period
-- (credits_period_start <> subscription.current_period_start). Overwrites
-- free_remaining (no rollover); never touches paid_balance.
create or replace function billing_ensure_period_grant()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org  uuid := current_org_id();
  v_sub  subscriptions%rowtype;
  v_cred org_credits%rowtype;
begin
  if v_org is null then return; end if;
  select * into v_sub from subscriptions where org_id = v_org;
  if not found then return; end if;

  select * into v_cred from org_credits where org_id = v_org;
  if not found then
    insert into org_credits (org_id, free_remaining, paid_balance, credits_period_start)
    values (v_org, greatest(v_sub.monthly_credits, 0), 0, v_sub.current_period_start)
    on conflict (org_id) do nothing;
    insert into credit_ledger (org_id, delta, kind, reason)
    values (v_org, greatest(v_sub.monthly_credits, 0), 'grant', 'initial period grant');
    return;
  end if;

  if v_sub.current_period_start is not null
     and v_cred.credits_period_start is distinct from v_sub.current_period_start then
    update org_credits
       set free_remaining = greatest(v_sub.monthly_credits, 0),
           credits_period_start = v_sub.current_period_start
     where org_id = v_org;
    insert into credit_ledger (org_id, delta, kind, reason)
    values (v_org, greatest(v_sub.monthly_credits, 0), 'grant', 'monthly period reset');
  end if;
end;
$$;

-- Decide whether the caller's org may make an AI call. Ensures the period grant
-- first, then checks subscription status + a positive combined balance.
create or replace function billing_gate()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org     uuid := current_org_id();
  v_sub     subscriptions%rowtype;
  v_cred    org_credits%rowtype;
  v_balance bigint;
begin
  if v_org is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_org');
  end if;
  select * into v_sub from subscriptions where org_id = v_org;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'no_subscription');
  end if;
  if v_sub.status not in ('active', 'trialing') then
    return jsonb_build_object('allowed', false, 'reason', 'inactive', 'status', v_sub.status);
  end if;

  perform billing_ensure_period_grant();
  select * into v_cred from org_credits where org_id = v_org;
  v_balance := coalesce(v_cred.free_remaining, 0) + coalesce(v_cred.paid_balance, 0);

  return jsonb_build_object(
    'allowed', v_balance > 0,
    'reason', case when v_balance > 0 then 'ok' else 'no_credits' end,
    'org_id', v_org,
    'free_remaining', coalesce(v_cred.free_remaining, 0),
    'paid_balance', coalesce(v_cred.paid_balance, 0),
    'balance', v_balance
  );
end;
$$;

-- Spend credits for the caller's org. Drains free_remaining first, then
-- paid_balance (which may go negative on the final call). Atomic: a single
-- UPDATE whose SET expressions all read the row's pre-update values.
create or replace function billing_spend(
  p_amount bigint,
  p_reason text default null,
  p_meta   jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org  uuid := current_org_id();
  v_cred org_credits%rowtype;
begin
  if v_org is null then
    return jsonb_build_object('ok', false, 'reason', 'no_org');
  end if;
  if p_amount is null or p_amount < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_amount');
  end if;
  if p_amount = 0 then
    return jsonb_build_object('ok', true, 'spent', 0);
  end if;

  update org_credits
     set free_remaining = free_remaining - least(free_remaining, p_amount),
         paid_balance   = paid_balance - (p_amount - least(free_remaining, p_amount))
   where org_id = v_org
  returning * into v_cred;

  if not found then
    insert into org_credits (org_id, free_remaining, paid_balance)
    values (v_org, 0, -p_amount)
    returning * into v_cred;
  end if;

  insert into credit_ledger (org_id, delta, kind, reason, meta)
  values (v_org, -p_amount, 'spend', p_reason, p_meta);

  return jsonb_build_object('ok', true, 'spent', p_amount,
    'free_remaining', v_cred.free_remaining, 'paid_balance', v_cred.paid_balance);
end;
$$;

-- Add paid credits to a specific org. SERVICE-ROLE ONLY (see revoke below): the
-- webhook calls this after a top-up payment succeeds. Never exposed to clients.
create or replace function billing_add_paid(
  p_org    uuid,
  p_amount bigint,
  p_reason text default 'top-up',
  p_meta   jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cred org_credits%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_amount');
  end if;

  insert into org_credits (org_id, paid_balance)
  values (p_org, p_amount)
  on conflict (org_id) do update
    set paid_balance = org_credits.paid_balance + excluded.paid_balance
  returning * into v_cred;

  insert into credit_ledger (org_id, delta, kind, reason, meta)
  values (p_org, p_amount, 'topup', p_reason, p_meta);

  return jsonb_build_object('ok', true, 'paid_balance', v_cred.paid_balance);
end;
$$;

revoke execute on function billing_add_paid(uuid, bigint, text, jsonb) from anon, authenticated;

-- === 4. Seed existing orgs ==================================================
-- Give every existing org a complimentary active subscription so the app keeps
-- working before anyone goes through Stripe. New orgs get theirs via checkout.

insert into subscriptions (org_id, tier, status, well_cap, monthly_credits,
                           current_period_start, current_period_end)
select id, 'tier_1', 'active', 49, 10000, now(), now() + interval '1 month'
from organizations
on conflict (org_id) do nothing;

insert into org_credits (org_id, free_remaining, paid_balance, credits_period_start)
select s.org_id, s.monthly_credits, 0, s.current_period_start
from subscriptions s
on conflict (org_id) do nothing;
