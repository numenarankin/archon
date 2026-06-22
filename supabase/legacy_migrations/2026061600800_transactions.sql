-- 2026061600800_transactions.sql
-- A single accounting ledger: every revenue and expense transaction, across all
-- wells. The /accounting page derives all of its figures (aggregate chart,
-- per-well chart, overview table, monthly report) from this one table. There is
-- deliberately no per-well financials table — wells are just a column here.
--
-- Revenue transactions carry extra structured fields (volume, price, prod_tax,
-- nri) so the monthly report can render the full revenue line; those columns are
-- null for expenses. Gated by the existing `view_financials` capability.

create table if not exists transactions (
  id             uuid primary key default gen_random_uuid(),
  -- 'revenue' (money in) or 'expense' (money out).
  kind           text not null check (kind in ('revenue', 'expense')),
  -- Payer (revenue) or recipient (expense).
  counterparty   text not null default '',
  -- Net dollar amount of the transaction (USD). Revenue is the net revenue that
  -- flows to the operator; expense is the cost. Always stored positive.
  amount         numeric not null default 0,
  txn_date       date not null,
  category       text not null default '',
  category_code  text not null default '',
  invoice_number text not null default '',
  well_id        text references wells (id) on delete set null,
  -- Revenue-only line components (null for expenses).
  volume         numeric,   -- produced volume sold (bbl / MCF)
  price          numeric,   -- realized unit price (USD)
  prod_tax       numeric,   -- production / severance tax withheld (USD)
  nri            numeric,   -- working interest net revenue interest (decimal)
  org_id         uuid references organizations (id) on delete cascade
                   default current_org_id(),
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists transactions_well_date_idx
  on transactions (well_id, txn_date);
create index if not exists transactions_date_idx on transactions (txn_date);

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- Backfill org_id for any rows created before the default was in place, then RLS.
do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations
    where owner_uid = (select id from auth.users
                       where lower(email) = 'jimpoage@proton.me');
  if v_org is not null then
    update transactions set org_id = v_org where org_id is null;
  end if;
end $$;

alter table transactions enable row level security;
drop policy if exists transactions_rls on transactions;
create policy transactions_rls on transactions for all
  using (has_capability(org_id, 'view_financials'))
  with check (has_capability(org_id, 'view_financials'));
