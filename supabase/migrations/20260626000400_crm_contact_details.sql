-- 20260626000400_crm_contact_details.sql
-- Flesh out the contact/account layer so this is something you can actually dial
-- and mail from. Adds:
--   * child tables for MANY emails and phones per contact, each with validity /
--     confidence (mapped to the operator_contacts skip-trace fields), so the
--     enrichment data lands somewhere instead of being flattened to one column;
--   * split first/last name, structured addresses, comms preferences, and the
--     handful of sales fields a real CRM needs;
--   * do_not_call vs do_not_email (legally distinct regimes) on contacts.
--
-- The single email/phone on crm_contacts stays as the cached PRIMARY (for list
-- views); the child tables hold the full, validated set. Child rows inherit
-- visibility through their parent contact's RLS, so they need no tenant columns.
-- Depends on 20260626000300_crm.sql.

-- ── Promote contact columns ─────────────────────────────────────────────────

alter table crm_contacts
  add column if not exists first_name      text,
  add column if not exists last_name       text,
  -- Structured mailing address (so you can filter/segment by geography).
  add column if not exists street          text,
  add column if not exists city            text,
  add column if not exists state           text,
  add column if not exists postal_code     text,
  add column if not exists country         text,
  -- Split suppression: a rep can often email someone they can't cold-call.
  add column if not exists do_not_call     boolean not null default false,
  add column if not exists do_not_email    boolean not null default false,
  -- Sales / engagement fields.
  add column if not exists lead_source     text,   -- 'map' | 'list_import' | 'referral' | ...
  add column if not exists status          text,   -- contact-level stage (configurable)
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_action_at  timestamptz,
  add column if not exists linkedin_url    text,
  add column if not exists timezone        text,   -- IANA, e.g. 'America/Chicago'
  add column if not exists best_time_to_call text; -- e.g. 'morning' | 'afternoon'

-- Replace the single combined flag with the per-channel ones (no data yet).
alter table crm_contacts drop column if exists do_not_contact;

create index if not exists crm_contacts_next_action_idx
  on crm_contacts (owner_id, next_action_at) where next_action_at is not null;

-- ── Contact emails (many per contact, with validity) ────────────────────────
-- Maps to operator_contacts: confidence <- email_confidence, grade <- email_grade.

create table crm_contact_emails (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references crm_contacts (id) on delete cascade,
  email      text not null,
  kind       text not null default 'work' check (kind in ('work', 'personal', 'other')),
  is_primary boolean not null default false,
  -- Validity from verification / enrichment.
  status     text check (status in ('verified', 'risky', 'invalid', 'unknown')),
  confidence int,                       -- 0-100, from the verifier / skip-trace
  grade      text,                      -- letter grade from the enrichment source
  source     text,                      -- 'skiptrace' | 'manual' | 'import' | ...
  created_at timestamptz not null default now()
);
create unique index crm_contact_emails_unique on crm_contact_emails (contact_id, lower(email));
-- At most one primary email per contact.
create unique index crm_contact_emails_primary on crm_contact_emails (contact_id) where is_primary;
create index crm_contact_emails_lookup on crm_contact_emails (lower(email));

alter table crm_contact_emails enable row level security;
create policy crm_contact_emails_rw on crm_contact_emails
  for all to authenticated
  using (exists (select 1 from crm_contacts c where c.id = crm_contact_emails.contact_id))
  with check (exists (select 1 from crm_contacts c where c.id = crm_contact_emails.contact_id));

-- ── Contact phones (many per contact, with line type + liveness) ────────────
-- Maps to operator_contacts: line_type <- phone_type, is_live <- phone_live.

create table crm_contact_phones (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references crm_contacts (id) on delete cascade,
  phone      text not null,                       -- E.164 preferred
  kind       text not null default 'mobile' check (kind in ('mobile', 'office', 'home', 'other')),
  is_primary boolean not null default false,
  line_type  text check (line_type in ('mobile', 'landline', 'voip', 'unknown')),
  is_live    boolean,                             -- did the line check out
  source     text,
  created_at timestamptz not null default now()
);
create unique index crm_contact_phones_unique on crm_contact_phones (contact_id, phone);
create unique index crm_contact_phones_primary on crm_contact_phones (contact_id) where is_primary;
create index crm_contact_phones_lookup on crm_contact_phones (phone);

alter table crm_contact_phones enable row level security;
create policy crm_contact_phones_rw on crm_contact_phones
  for all to authenticated
  using (exists (select 1 from crm_contacts c where c.id = crm_contact_phones.contact_id))
  with check (exists (select 1 from crm_contacts c where c.id = crm_contact_phones.contact_id));

-- ── Account firmographics + structured address + dedup helpers ──────────────
-- Lighter touch than contacts (most long-tail account attributes can ride in
-- `custom`), but these are the ones you filter, dedupe, and report on.

alter table crm_accounts
  add column if not exists domain         text,   -- normalized, for dedup/matching
  add column if not exists industry       text,
  add column if not exists employee_count int,
  add column if not exists annual_revenue numeric,
  -- Structured location (county matters for the oil side).
  add column if not exists city           text,
  add column if not exists state          text,
  add column if not exists postal_code    text,
  add column if not exists county         text,
  add column if not exists country        text,
  add column if not exists primary_contact_id uuid references crm_contacts (id) on delete set null;

create index if not exists crm_accounts_domain_idx on crm_accounts (lower(domain));
