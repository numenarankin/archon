-- 20260614000500_people.sql
-- People: contractors, service providers, and royalty owners.

create table contractors (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  company text,
  trade   text,
  phone   text,
  email   text,
  status  person_status not null default 'Active'
);

create table service_providers (
  id      uuid primary key default gen_random_uuid(),
  company text not null,
  service text,
  contact text,
  phone   text,
  email   text,
  status  person_status not null default 'Active'
);

create table royalty_owners (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  interest_type    interest_type not null,
  decimal_interest numeric not null,   -- net decimal fraction of revenue
  email            text,
  mailing_address  text,
  last_payment     numeric not null default 0
);

-- Which wells each owner holds an interest in (replaces wellIds[] array) ----
create table royalty_owner_wells (
  royalty_owner_id uuid not null references royalty_owners (id) on delete cascade,
  well_id          text not null references wells (id) on delete cascade,
  primary key (royalty_owner_id, well_id)
);
create index royalty_owner_wells_well_idx on royalty_owner_wells (well_id);
