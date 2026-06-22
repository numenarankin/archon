#!/usr/bin/env python3
"""Build the compact PDQ production tables and load them into Supabase Postgres
(direct connection, DuckDB COPY).

We do NOT load the raw 78M-row monthly history (it doesn't fit and isn't needed
online). Instead DuckDB aggregates the }-delimited .dsv files locally and we load
only app-ready tables (~3M rows total), per
`supabase/migrations/20260622000400_production_aggregates.sql`:

  leases, well_lease, operator_production,
  lease_summary            (one row per lease: lifetime + last-12mo totals),
  lease_production_recent  (last 12 months of monthly detail)

Set DATABASE_URL to the Supabase Session-pooler connection string:

  DATABASE_URL='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' \\
    python3 scripts/load_pdq_supabase.py

Re-runnable: each table is truncated before load.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import duckdb

SUPERAPP = Path(__file__).resolve().parents[1]
ROOT = SUPERAPP.parent
PDQ = ROOT / "wildcat-data" / "pdq"


def src(name: str) -> str:
    path = PDQ / f"{name}_DATA_TABLE.dsv"
    if not path.exists():
        raise SystemExit(f"missing source file: {path}")
    return (
        f"read_csv('{path}', delim='}}', header=true, all_varchar=true, "
        f"quote='', strict_mode=false)"
    )


def n(col: str) -> str:
    return f"nullif(trim({col}), '')"


def latest_cycle_idx(con) -> int:
    """Global newest cycle as a month index (year*12 + month), from the small
    operator-cycle file. Used to define the 'last 12 months' window."""
    q = (
        f"select max((c // 100) * 12 + (c % 100)) from "
        f"(select try_cast({n('CYCLE_YEAR_MONTH')} as integer) c "
        f"from {src('OG_OPERATOR_CYCLE')}) where c is not null"
    )
    return int(con.sql(q).fetchone()[0])


# Typed view over the 78M-row lease-cycle file (cast once, reuse).
def _lease_rows() -> str:
    return f"""
        select OIL_GAS_CODE as oil_gas_code,
               try_cast({n('DISTRICT_NO')} as smallint) as district_no,
               try_cast({n('LEASE_NO')} as integer) as lease_no,
               try_cast({n('OPERATOR_NO')} as integer) as operator_no,
               try_cast({n('FIELD_NO')} as bigint) as field_no,
               try_cast({n('CYCLE_YEAR_MONTH')} as integer) as cyc,
               coalesce(try_cast({n('LEASE_OIL_PROD_VOL')} as bigint), 0) as oil,
               coalesce(try_cast({n('LEASE_GAS_PROD_VOL')} as bigint), 0) as gas,
               coalesce(try_cast({n('LEASE_COND_PROD_VOL')} as bigint), 0) as cond
        from {src('OG_LEASE_CYCLE')}
    """


def build_loads(cutoff_idx: int):
    """(target table, column list, SELECT) for each table. cutoff_idx is the
    month index 12 months before the newest cycle; rows with a greater index are
    'last 12 months'."""
    recent = f"((cyc // 100) * 12 + (cyc % 100)) > {cutoff_idx}"
    return [
        (
            "leases",
            "oil_gas_code,district_no,lease_no,lease_name,operator_no,operator_name,"
            "field_no,field_name,district_name,off_sched,severance",
            f"""
            select OIL_GAS_CODE,
                   try_cast({n('DISTRICT_NO')} as smallint),
                   try_cast({n('LEASE_NO')} as integer),
                   {n('LEASE_NAME')},
                   try_cast({n('OPERATOR_NO')} as integer),
                   {n('OPERATOR_NAME')},
                   try_cast({n('FIELD_NO')} as bigint),
                   {n('FIELD_NAME')},
                   {n('DISTRICT_NAME')},
                   (trim(LEASE_OFF_SCHED_FLAG) = 'Y'),
                   (trim(LEASE_SEVERANCE_FLAG) = 'Y')
            from {src('OG_REGULATORY_LEASE_DW')}
            qualify row_number() over (
              partition by OIL_GAS_CODE, DISTRICT_NO, LEASE_NO) = 1
            """,
        ),
        (
            "well_lease",
            "api_number,oil_gas_code,district_no,lease_no,well_no",
            f"""
            select try_cast({n('API_COUNTY_CODE')} as integer) * 100000
                     + try_cast({n('API_UNIQUE_NO')} as integer),
                   OIL_GAS_CODE,
                   try_cast({n('DISTRICT_NO')} as smallint),
                   try_cast({n('LEASE_NO')} as integer),
                   {n('WELL_NO')}
            from {src('OG_WELL_COMPLETION')}
            where {n('API_UNIQUE_NO')} is not null
              and {n('API_COUNTY_CODE')} is not null
            """,
        ),
        (
            "operator_production",
            "operator_no,cycle,operator_name,oil_prod_vol,gas_prod_vol,"
            "cond_prod_vol,csgd_prod_vol",
            f"""
            select try_cast({n('OPERATOR_NO')} as integer),
                   try_cast({n('CYCLE_YEAR_MONTH')} as integer),
                   {n('OPERATOR_NAME')},
                   try_cast({n('OPER_OIL_PROD_VOL')} as bigint),
                   try_cast({n('OPER_GAS_PROD_VOL')} as bigint),
                   try_cast({n('OPER_COND_PROD_VOL')} as bigint),
                   try_cast({n('OPER_CSGD_PROD_VOL')} as bigint)
            from {src('OG_OPERATOR_CYCLE')}
            where try_cast({n('OPERATOR_NO')} as integer) is not null
            qualify row_number() over (
              partition by OPERATOR_NO, CYCLE_YEAR_MONTH) = 1
            """,
        ),
        (
            "lease_summary",
            "oil_gas_code,district_no,lease_no,operator_no,field_no,first_cycle,"
            "last_cycle,months_reported,oil_total,gas_total,cond_total,"
            "oil_last12,gas_last12,cond_last12",
            f"""
            with rows as ({_lease_rows()})
            select oil_gas_code, district_no, lease_no,
                   arg_max(operator_no, cyc) as operator_no,
                   arg_max(field_no, cyc)    as field_no,
                   min(cyc) as first_cycle, max(cyc) as last_cycle,
                   count(*) as months_reported,
                   sum(oil)   as oil_total,
                   sum(gas)   as gas_total,
                   sum(cond)  as cond_total,
                   sum(case when {recent} then oil  else 0 end) as oil_last12,
                   sum(case when {recent} then gas  else 0 end) as gas_last12,
                   sum(case when {recent} then cond else 0 end) as cond_last12
            from rows
            where district_no is not null and lease_no is not null
            group by 1, 2, 3
            """,
        ),
        (
            "lease_production_recent",
            "oil_gas_code,district_no,lease_no,cycle,operator_no,"
            "oil_prod_vol,gas_prod_vol,cond_prod_vol",
            f"""
            with rows as ({_lease_rows()})
            select oil_gas_code, district_no, lease_no, cyc, operator_no,
                   oil, gas, cond
            from rows
            where district_no is not null and lease_no is not null and {recent}
            """,
        ),
    ]


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: set DATABASE_URL to your Supabase Postgres connection string")
        return 1
    only = set(sys.argv[1:])
    con = duckdb.connect()
    con.execute("pragma memory_limit='4GB'")
    con.execute(f"pragma temp_directory='{SUPERAPP / '.tiles-build'}'")
    cutoff = latest_cycle_idx(con) - 12
    con.execute("install postgres; load postgres;")
    con.execute(f"attach '{url}' as pg (type postgres)")
    for table, cols, sel in build_loads(cutoff):
        if only and table not in only:
            continue
        t = time.time()
        con.execute(
            "call postgres_execute('pg', "
            f"'truncate table public.{table} restart identity cascade')"
        )
        con.execute(f"insert into pg.public.{table} ({cols}) {sel}")
        n_rows = con.sql(f"select count(*) from pg.public.{table}").fetchone()[0]
        print(f"  {table}: {n_rows:,} rows in {time.time() - t:.0f}s", flush=True)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
