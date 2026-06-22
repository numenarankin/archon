#!/usr/bin/env python3
"""Export the enrichment input CSV: one row per operator's top decision-maker.

Calls the `operators_for_enrichment(p_min_wells)` SQL function (migration
20260622000400_operator_contacts.sql) and writes the columns Skip Trace PRO
needs: name, phone, state (plus operator_no for our own mapping).

Set DATABASE_URL to your Supabase Postgres connection string:

  DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres' \\
    python3 scripts/export_enrichment_csv.py --min-wells 20 --out enrichment_input.csv

Then upload the CSV to Supabase Storage, generate a signed URL, and pass it to
scripts/run_enrichment.py.
"""
from __future__ import annotations

import argparse
import os
import sys

import duckdb


def main() -> int:
    ap = argparse.ArgumentParser(description="Export enrichment input CSV")
    ap.add_argument("--min-wells", type=int, default=20)
    ap.add_argument("--out", default="enrichment_input.csv")
    args = ap.parse_args()

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: set DATABASE_URL to your Supabase Postgres connection string")
        return 1

    con = duckdb.connect()
    con.execute("install postgres; load postgres;")
    con.execute(f"attach '{url}' as pg (type postgres)")

    # The columns the scraper reads (name/phone/state) plus operator_no, which we
    # keep so the webhook can map a returned person back to its operator.
    con.execute(
        f"""
        copy (
          select operator_no,
                 search_name as name,
                 phone,
                 state,
                 wells
          from pg.public.operators_for_enrichment({args.min_wells}, NULL)
          order by wells desc
        ) to '{args.out}' (header, delimiter ',')
        """
    )
    n = con.sql(f"select count(*) from read_csv('{args.out}')").fetchone()[0]
    print(f"wrote {n:,} rows to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
