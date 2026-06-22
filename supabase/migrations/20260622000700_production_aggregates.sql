-- 20260622000400_production_aggregates.sql
-- Replace the oversized raw lease_production table (78M rows, ~15GB with indexes,
-- which does NOT fit this instance) with compact, app-ready tables:
--   * lease_summary           - one row per lease (lifetime + last-12mo totals)
--   * lease_production_recent - last 12 months of monthly detail (recent curves)
-- The full monthly history stays in DuckDB/Parquet (wildcat-data/pdq); only these
-- aggregates live in Postgres.
--
-- Kept from 20260622000300: leases, well_lease, operator_production (+ its series
-- function). Removed: the raw lease_production table and its monthly functions.

drop function if exists well_production_series(integer);
drop function if exists lease_production_series(char, smallint, integer);
drop table if exists lease_production;

-- Per-lease summary (from OG_LEASE_CYCLE, aggregated in DuckDB). ~547k rows.
-- Oil/condensate in BBL, gas in MCF.
create table lease_summary (
  oil_gas_code    char(1)  not null,
  district_no     smallint not null,
  lease_no        integer  not null,
  operator_no     integer,                 -- operator on the most recent cycle
  field_no        bigint,
  first_cycle     integer,                 -- earliest cycle YYYYMM
  last_cycle      integer,                 -- latest cycle YYYYMM
  months_reported integer,
  oil_total       bigint,
  gas_total       bigint,
  cond_total      bigint,
  oil_last12      bigint,
  gas_last12      bigint,
  cond_last12     bigint,
  primary key (oil_gas_code, district_no, lease_no)
);
create index lease_summary_operator_idx on lease_summary (operator_no);

-- Last 12 months of monthly lease production (from OG_LEASE_CYCLE). ~2.4M rows.
-- Powers recent per-lease / per-well decline curves without the full 78M history.
create table lease_production_recent (
  oil_gas_code  char(1)  not null,
  district_no   smallint not null,
  lease_no      integer  not null,
  cycle         integer  not null,         -- YYYYMM
  operator_no   integer,
  oil_prod_vol  bigint,
  gas_prod_vol  bigint,
  cond_prod_vol bigint,
  primary key (oil_gas_code, district_no, lease_no, cycle)
);
create index lease_prod_recent_lease_idx on lease_production_recent (oil_gas_code, district_no, lease_no);

alter table lease_summary           enable row level security;
alter table lease_production_recent enable row level security;
create policy lease_summary_authenticated on lease_summary
  for all to authenticated using (true) with check (true);
create policy lease_prod_recent_authenticated on lease_production_recent
  for all to authenticated using (true) with check (true);

-- Per-well lifetime/last-12 totals for one API, from lease_summary across its
-- completions. Gas passes through (gas lease ~= one well); OIL and condensate are
-- reported at the lease and ALLOCATED EVENLY across the lease's wells (an
-- ESTIMATE, flagged by is_oil_allocated + lease_well_count so the UI can label it).
create or replace function well_production_summary(p_api integer)
returns table (
  oil_total_alloc numeric, gas_total bigint, cond_total_alloc numeric,
  oil_last12_alloc numeric, gas_last12 bigint,
  lease_well_count integer, is_oil_allocated boolean
)
language sql stable security invoker as $$
  with wl as (
    select distinct oil_gas_code, district_no, lease_no
    from well_lease where api_number = p_api
  ),
  cnt as (
    select b.oil_gas_code, b.district_no, b.lease_no,
           count(distinct b.api_number) as n
    from well_lease b join wl using (oil_gas_code, district_no, lease_no)
    group by 1, 2, 3
  )
  select
    sum(s.oil_total::numeric  / nullif(cnt.n, 0)),
    sum(s.gas_total),
    sum(s.cond_total::numeric / nullif(cnt.n, 0)),
    sum(s.oil_last12::numeric / nullif(cnt.n, 0)),
    sum(s.gas_last12),
    max(cnt.n)::integer,
    (max(cnt.n) > 1)
  from lease_summary s join cnt using (oil_gas_code, district_no, lease_no)
$$;

-- Per-well recent monthly series (last 12 months), oil/condensate allocated the
-- same way. Returns one row per cycle for charting a recent curve.
create or replace function well_production_recent(p_api integer)
returns table (
  cycle integer, oil_prod_vol_alloc numeric, gas_prod_vol bigint,
  lease_well_count integer, is_oil_allocated boolean
)
language sql stable security invoker as $$
  with wl as (
    select distinct oil_gas_code, district_no, lease_no
    from well_lease where api_number = p_api
  ),
  cnt as (
    select b.oil_gas_code, b.district_no, b.lease_no,
           count(distinct b.api_number) as n
    from well_lease b join wl using (oil_gas_code, district_no, lease_no)
    group by 1, 2, 3
  )
  select
    r.cycle,
    sum(r.oil_prod_vol::numeric / nullif(cnt.n, 0)),
    sum(r.gas_prod_vol),
    max(cnt.n)::integer,
    (max(cnt.n) > 1)
  from lease_production_recent r join cnt using (oil_gas_code, district_no, lease_no)
  group by r.cycle
  order by r.cycle
$$;

grant execute on function well_production_summary(integer) to anon, authenticated;
grant execute on function well_production_recent(integer)  to anon, authenticated;
