-- 20260623000500_budgeting.sql
-- Personal budgeting: a lightweight ledger of income/expense transactions plus
-- the upload batches behind AI-extracted receipts/statements. Mirrors the
-- accounting feature but retrofitted for individual finances — no wells, no
-- royalty owners, no oil & gas revenue fields. Single-tenant RLS like the rest
-- of the app (any authenticated user has full access).

-- Upload batches: one row per imported file. Deleting it cascades to the
-- transactions created from it (the one-step undo for a bad import).
create table budget_uploads (
  id           uuid primary key default gen_random_uuid(),
  file_name    text,
  mime         text,
  size         bigint,
  storage_key  text,                            -- key in the budget-uploads bucket
  txn_count    integer not null default 0,
  total_amount numeric not null default 0,
  created_at   timestamptz not null default now()
);

alter table budget_uploads enable row level security;
create policy budget_uploads_authenticated on budget_uploads
  for all to authenticated using (true) with check (true);

-- The ledger: income / expense rows.
create table budget_transactions (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('income', 'expense')),
  payee         text,                            -- source (income) or merchant (expense)
  amount        numeric not null default 0,      -- positive dollar amount
  txn_date      date not null,
  category      text,                            -- human label, e.g. "Groceries"
  category_code text,                            -- code, e.g. "EXP-GROC"
  note          text,                            -- free-form reference / memo
  account       text,                            -- e.g. "Checking", "Credit Card"
  upload_id     uuid references budget_uploads (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index budget_transactions_date_idx      on budget_transactions (txn_date);
create index budget_transactions_upload_id_idx on budget_transactions (upload_id);

create trigger budget_transactions_set_updated_at
  before update on budget_transactions
  for each row execute function set_updated_at();

alter table budget_transactions enable row level security;
create policy budget_transactions_authenticated on budget_transactions
  for all to authenticated using (true) with check (true);

-- Private bucket for the original uploaded files (served via signed URLs).
insert into storage.buckets (id, name, public)
values ('budget-uploads', 'budget-uploads', false)
on conflict (id) do nothing;
create policy budget_uploads_bucket_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'budget-uploads') with check (bucket_id = 'budget-uploads');
