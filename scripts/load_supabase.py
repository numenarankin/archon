#!/usr/bin/env python3
"""Load the parsed RRC data from Parquet into Supabase Postgres.

Streams the Parquet/DuckDB layer straight into the tables created by
`supabase/migrations/20260621001000_wells_operators.sql` using DuckDB's postgres
extension (fast bulk insert, no intermediate CSVs).

Set DATABASE_URL to your Supabase Postgres connection string (Dashboard ->
Project Settings -> Database -> Connection string; use the direct/session
connection, with sslmode=require):

  DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres' \\
    python3 scripts/load_supabase.py

Re-runnable: each table is truncated before load.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

SUPERAPP = Path(__file__).resolve().parents[1]
ROOT = SUPERAPP.parent
sys.path.insert(0, str(ROOT / "src"))

from wildcat.db import connect  # noqa: E402

# target table -> (target column list, source SELECT against the DuckDB views)
LOADS = [
    ("operators",
     "operator_number,operator_name,p5_status,addr_line1,addr_line2,city,state,"
     "zip,zip_suffix,phone,last_p5_date,oil_gatherer,gas_gatherer",
     "select operator_number,operator_name,p5_status,addr_line1,addr_line2,city,"
     "state,zip,zip_suffix,phone,last_p5_date,oil_gatherer,gas_gatherer from operators"),
    ("operator_officers",
     "operator_number,officer_name,officer_title,officer_addr_line1,officer_city,"
     "officer_state,officer_zip",
     "select operator_number,officer_name,officer_title,officer_addr_line1,"
     "officer_city,officer_state,officer_zip from operator_officers"),
    ("wells",
     "api_number,county_code,admin_district,oil_gas,oil_gas_label,water_land,"
     "is_plugged,has_fresh_water,total_depth,n_formations,deepest_formation_depth,"
     "n_completions,latitude,longitude,plugged_d,w3_filed_d",
     "select api_number,county_code,admin_district,oil_gas,oil_gas_label,water_land,"
     "is_plugged,has_fresh_water,total_depth,n_formations,deepest_formation_depth,"
     "n_completions,latitude,longitude,plugged_d,w3_filed_d from well_summary "
     "qualify row_number() over (partition by api_number) = 1"),
    ("well_operator",
     "api_number,operator_number,operator_source,plugging_operator_name",
     "select api_number,operator_number,operator_source,plugging_operator_name "
     "from well_operator"),
    ("permits",
     "api_number,operator_number,permit_number,permit_seq,county_code,district,"
     "lease_name,well_number,total_depth,type_application,issued_date,well_status",
     "select api_number,operator_number,permit_number,permit_seq,county_code,"
     "district,lease_name,well_number,total_depth,type_application,issued_date,"
     "well_status from permits where api_number > 0"),
]


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: set DATABASE_URL to your Supabase Postgres connection string")
        return 1
    con = connect(ROOT / "parquet")
    con.execute("install postgres; load postgres;")
    con.execute(f"attach '{url}' as pg (type postgres)")
    for table, cols, sel in LOADS:
        t = time.time()
        con.execute(
            f"call postgres_execute('pg', "
            f"'truncate table public.{table} restart identity cascade')")
        con.execute(f"insert into pg.public.{table} ({cols}) {sel}")
        n = con.sql(f"select count(*) from pg.public.{table}").fetchone()[0]
        print(f"  {table}: {n:,} rows in {time.time() - t:.0f}s")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
