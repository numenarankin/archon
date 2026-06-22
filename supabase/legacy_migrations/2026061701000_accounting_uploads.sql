-- 2026061701000_accounting_uploads.sql
-- Tracks each accounting file upload as a batch, so a batch can be undone in one
-- step. Every transaction created from an uploaded file points at its
-- `accounting_uploads` row via `transactions.upload_id` with ON DELETE CASCADE —
-- deleting the upload row therefore removes all of its transactions atomically,
-- and the stored file is removed alongside it from the private bucket.
--
-- Manual (non-upload) transactions have upload_id = NULL and are unaffected.
--
-- Append-only + idempotent.

-- === 1. Uploads table =======================================================
create table if not exists accounting_uploads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations (id) on delete cascade
                  default current_org_id(),
  file_name     text not null default '',
  mime          text,
  size          bigint,
  -- Object key in the private `accounting-uploads` bucket (NULL if the bytes
  -- were not persisted).
  storage_key   text,
  -- Denormalized batch totals, shown in the Uploads tab without re-aggregating.
  txn_count     integer not null default 0,
  total_amount  numeric not null default 0,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists accounting_uploads_org_idx
  on accounting_uploads (org_id, created_at desc);

-- === 2. Link transactions to their upload batch =============================
alter table transactions
  add column if not exists upload_id uuid
    references accounting_uploads (id) on delete cascade;
create index if not exists transactions_upload_idx on transactions (upload_id);

-- === 3. RLS: gate on the same capability as the ledger ======================
alter table accounting_uploads enable row level security;
drop policy if exists accounting_uploads_rls on accounting_uploads;
create policy accounting_uploads_rls on accounting_uploads for all
  using (has_capability(org_id, 'view_financials'))
  with check (has_capability(org_id, 'view_financials'));

-- === 4. Private bucket for the original files ===============================
-- Bytes are reached only server-side via the service-role key (same model as
-- the `files` bucket), so the bucket stays private with no object policies.
insert into storage.buckets (id, name, public)
values ('accounting-uploads', 'accounting-uploads', false)
on conflict (id) do nothing;
