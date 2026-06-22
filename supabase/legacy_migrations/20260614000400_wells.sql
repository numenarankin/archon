-- 20260614000400_wells.sql
-- Wells and their related operational data.

create table wells (
  id             text primary key,            -- slug / URL id
  name           text not null,
  zone           text,                         -- producing formation
  perforations   text,
  county         text,
  depth          numeric,                      -- feet
  date_drilled   date,
  -- Current snapshot economics. These are really aggregates of
  -- production_readings + price/cost; kept here denormalized for the list view.
  oil_production numeric,
  gas_production numeric,
  salt_water     numeric,
  revenue        numeric,
  lifting_cost   numeric,
  pl             numeric,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger wells_set_updated_at
  before update on wells
  for each row execute function set_updated_at();

-- Daily production history --------------------------------------------------
create table production_readings (
  id             uuid primary key default gen_random_uuid(),
  well_id        text not null references wells (id) on delete cascade,
  reading_date   date not null,
  reading_time   time,
  oil_production numeric,
  oil_stock      numeric,
  oil_sales      numeric,
  gas_production numeric,
  salt_water     numeric,
  created_at     timestamptz not null default now(),
  unique (well_id, reading_date, reading_time)
);
create index production_readings_well_date_idx
  on production_readings (well_id, reading_date);

-- Comments -----------------------------------------------------------------
create table well_comments (
  id         uuid primary key default gen_random_uuid(),
  well_id    text not null references wells (id) on delete cascade,
  author_id  uuid references users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index well_comments_well_idx on well_comments (well_id);

-- Equipment ----------------------------------------------------------------
create table well_equipment (
  id           uuid primary key default gen_random_uuid(),
  well_id      text not null references wells (id) on delete cascade,
  name         text not null,
  type         text,
  status       equipment_status not null default 'Operational',
  installed_at date
);
create index well_equipment_well_idx on well_equipment (well_id);
