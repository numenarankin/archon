-- 20260622000300_leases_production.sql
-- RRC PDQ production data: leases, the well->lease bridge, monthly lease
-- production, and a monthly per-operator rollup.
--
-- Source: the PDQ_DSV dump (}-delimited), loaded by scripts/load_pdq_supabase.py.
-- Production in Texas is reported by LEASE, not by well, so the lease is a
-- first-class entity here, run in parallel with the existing api_number-keyed
-- `wells` table and bridged by `well_lease` (from OG_WELL_COMPLETION).
--
-- Keys: a lease is (oil_gas_code, district_no, lease_no). Oil and gas leases
-- share the same district/lease number space, so oil_gas_code is part of the key.
-- Operator numbers are the same 6-digit P-5 numbers as `operators.operator_number`.
-- RLS follows the app convention (authenticated-only, full access).

-- Lease dimension (from OG_REGULATORY_LEASE_DW) ----------------------------
create table leases (
  oil_gas_code  char(1)  not null,        -- 'O' oil, 'G' gas
  district_no   smallint not null,
  lease_no      integer  not null,
  lease_name    text,
  operator_no   integer,                  -- joins operators.operator_number
  operator_name text,
  field_no      bigint,
  field_name    text,
  district_name text,
  off_sched     boolean,
  severance     boolean,
  primary key (oil_gas_code, district_no, lease_no)
);
create index leases_operator_idx on leases (operator_no);

-- Well <-> lease bridge (from OG_WELL_COMPLETION) --------------------------
-- Many-to-many: a wellbore can have several completions across leases, and a
-- lease has many wells. api_number = api_county_code * 100000 + api_unique_no,
-- matching `wells.api_number`.
create table well_lease (
  id           bigint generated always as identity primary key,
  api_number   integer  not null,
  oil_gas_code char(1)  not null,
  district_no  smallint not null,
  lease_no     integer  not null,
  well_no      text
);
create index well_lease_api_idx   on well_lease (api_number);
create index well_lease_lease_idx on well_lease (oil_gas_code, district_no, lease_no);

-- Monthly production by lease (from OG_LEASE_CYCLE) ------------------------
-- ~78.2M rows, Jan 1993 to current. Oil/condensate in BBL, gas/casinghead in MCF.
create table lease_production (
  oil_gas_code     char(1)  not null,
  district_no      smallint not null,
  lease_no         integer  not null,
  cycle            integer  not null,     -- CYCLE_YEAR_MONTH, e.g. 202601
  operator_no      integer,               -- reporting operator THAT month (historical)
  field_no         bigint,
  oil_prod_vol     bigint,                -- BBL
  oil_allow        bigint,
  oil_ending_bal   bigint,
  gas_prod_vol     bigint,                -- MCF
  gas_allow        bigint,
  gas_lift_inj_vol bigint,
  cond_prod_vol    bigint,                -- BBL
  csgd_prod_vol    bigint,                -- MCF (casinghead)
  prod_report_filed boolean,
  primary key (oil_gas_code, district_no, lease_no, cycle)
);
create index lease_production_operator_cycle_idx on lease_production (operator_no, cycle);
create index lease_production_cycle_idx          on lease_production (cycle);

-- Monthly production rolled up by operator (from OG_OPERATOR_CYCLE) --------
-- Pre-aggregated so per-operator views don't GROUP BY over 35M rows.
create table operator_production (
  operator_no   integer  not null,
  cycle         integer  not null,
  operator_name text,
  oil_prod_vol  bigint,
  gas_prod_vol  bigint,
  cond_prod_vol bigint,
  csgd_prod_vol bigint,
  primary key (operator_no, cycle)
);

-- RLS: authenticated-only, full access (matches wells/operators) -----------
alter table leases              enable row level security;
alter table well_lease          enable row level security;
alter table lease_production    enable row level security;
alter table operator_production enable row level security;

create policy leases_authenticated on leases
  for all to authenticated using (true) with check (true);
create policy well_lease_authenticated on well_lease
  for all to authenticated using (true) with check (true);
create policy lease_production_authenticated on lease_production
  for all to authenticated using (true) with check (true);
create policy operator_production_authenticated on operator_production
  for all to authenticated using (true) with check (true);

-- Query functions (PostgREST can't GROUP BY / allocate). security invoker
-- so they respect RLS. -----------------------------------------------------

-- Monthly production series for one lease (for a lease detail panel / sparkline).
create or replace function lease_production_series(
  p_oil_gas char(1),
  p_district smallint,
  p_lease integer
)
returns table (
  cycle integer, oil_prod_vol bigint, gas_prod_vol bigint,
  cond_prod_vol bigint, csgd_prod_vol bigint
)
language sql stable security invoker as $$
  select cycle, oil_prod_vol, gas_prod_vol, cond_prod_vol, csgd_prod_vol
  from lease_production
  where oil_gas_code = p_oil_gas and district_no = p_district and lease_no = p_lease
  order by cycle
$$;

-- Monthly production series for one operator (from the rollup).
create or replace function operator_production_series(p_operator integer)
returns table (
  cycle integer, oil_prod_vol bigint, gas_prod_vol bigint,
  cond_prod_vol bigint, csgd_prod_vol bigint
)
language sql stable security invoker as $$
  select cycle, oil_prod_vol, gas_prod_vol, cond_prod_vol, csgd_prod_vol
  from operator_production
  where operator_no = p_operator
  order by cycle
$$;

-- Per-well production for one API, summing across its lease completions.
-- Gas is ~one well per lease so it is effectively metered; OIL is reported at
-- the lease and ALLOCATED EVENLY across the lease's wells (an ESTIMATE, flagged
-- by is_oil_allocated + lease_well_count so the UI can label it).
create or replace function well_production_series(p_api integer)
returns table (
  cycle integer,
  oil_prod_vol_alloc numeric,
  gas_prod_vol bigint,
  lease_well_count integer,
  is_oil_allocated boolean
)
language sql stable security invoker as $$
  with wl as (
    select distinct oil_gas_code, district_no, lease_no
    from well_lease where api_number = p_api
  ),
  cnt as (
    select b.oil_gas_code, b.district_no, b.lease_no,
           count(distinct b.api_number) as n
    from well_lease b
    join wl using (oil_gas_code, district_no, lease_no)
    group by 1,2,3
  )
  select lp.cycle,
         sum(lp.oil_prod_vol::numeric / nullif(cnt.n,0)) as oil_prod_vol_alloc,
         sum(lp.gas_prod_vol)                            as gas_prod_vol,
         max(cnt.n)::integer                             as lease_well_count,
         (max(cnt.n) > 1)                                as is_oil_allocated
  from lease_production lp
  join cnt using (oil_gas_code, district_no, lease_no)
  group by lp.cycle
  order by lp.cycle
$$;

grant execute on function lease_production_series(char, smallint, integer) to anon, authenticated;
grant execute on function operator_production_series(integer)             to anon, authenticated;
grant execute on function well_production_series(integer)                 to anon, authenticated;
