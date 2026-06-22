-- 20260621001000_wells_operators.sql
-- RRC well + operator data for the /map page.
--
-- The map dots are served as static vector tiles (public/tiles/wells.pmtiles),
-- so these tables back the click-a-well detail panel and operator lookups, keyed
-- by api_number / operator_number. No PostGIS needed: positions live in the
-- tiles, and detail lookups are by key. RLS follows the app convention
-- (authenticated-only, full access).

-- Operators (P-5 master, from orf850) --------------------------------------
create table operators (
  operator_number integer primary key,
  operator_name   text,
  p5_status       text,           -- A=Active I=Inactive D=Delinquent S=See remarks
  addr_line1      text,
  addr_line2      text,
  city            text,
  state           text,
  zip             integer,
  zip_suffix      integer,
  last_p5_date    integer,        -- CCYYMMDD
  oil_gatherer    text,
  gas_gatherer    text
);

-- Officers / principals (from orf850 K records) ----------------------------
create table operator_officers (
  id                 bigint generated always as identity primary key,
  operator_number    integer not null,
  officer_name       text,
  officer_title      text,
  officer_addr_line1 text,
  officer_city       text,
  officer_state      text,
  officer_zip        integer
);
create index operator_officers_opnum_idx on operator_officers (operator_number);

-- Wells (from well_summary + well_location) --------------------------------
create table wells (
  api_number              integer primary key,
  county_code             integer,
  admin_district          integer,
  oil_gas                 text,
  oil_gas_label           text,
  water_land              text,
  is_plugged              boolean,
  has_fresh_water         boolean,
  total_depth             integer,
  n_formations            integer,
  deepest_formation_depth integer,
  n_completions           integer,
  latitude                double precision,
  longitude               double precision,
  plugged_d               date,
  w3_filed_d              date
);
create index wells_district_idx on wells (admin_district);

-- Resolved operator per well (current -> role-based) -----------------------
create table well_operator (
  api_number             integer primary key,
  operator_number        integer,
  operator_source        text,    -- 'permit' | 'h15' | null
  plugging_operator_name text
);
create index well_operator_opnum_idx on well_operator (operator_number);

-- Drilling permits (from daf804) -------------------------------------------
create table permits (
  id               bigint generated always as identity primary key,
  api_number       integer,
  operator_number  integer,
  permit_number    integer,
  permit_seq       integer,
  county_code      integer,
  district         text,
  lease_name       text,
  well_number      text,
  total_depth      integer,
  type_application text,
  issued_date      integer,       -- CCYYMMDD
  well_status      text
);
create index permits_api_idx on permits (api_number);
create index permits_opnum_idx on permits (operator_number);

-- Click-a-well payload: well's operator + profile + officer count -----------
create view well_operator_detail
with (security_invoker = on) as
select wo.api_number, wo.operator_number, wo.operator_source,
       wo.plugging_operator_name,
       o.operator_name, o.p5_status, o.addr_line1, o.addr_line2,
       o.city, o.state, o.zip, o.last_p5_date,
       coalesce(o.operator_name, wo.plugging_operator_name)
           as operator_display_name,
       (select count(*) from operator_officers k
        where k.operator_number = wo.operator_number) as officer_count
from well_operator wo
left join operators o on o.operator_number = wo.operator_number;

-- RLS: authenticated-only, full access (matches the app's auth model) -------
alter table operators         enable row level security;
alter table operator_officers enable row level security;
alter table wells             enable row level security;
alter table well_operator     enable row level security;
alter table permits           enable row level security;

create policy operators_authenticated on operators
  for all to authenticated using (true) with check (true);
create policy operator_officers_authenticated on operator_officers
  for all to authenticated using (true) with check (true);
create policy wells_authenticated on wells
  for all to authenticated using (true) with check (true);
create policy well_operator_authenticated on well_operator
  for all to authenticated using (true) with check (true);
create policy permits_authenticated on permits
  for all to authenticated using (true) with check (true);
