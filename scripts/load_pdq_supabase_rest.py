#!/usr/bin/env python3
"""Load the compact PDQ production tables into Supabase via the PostgREST API.

Same aggregate tables as load_pdq_supabase.py, but uses only what's in .env.local
(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY) instead of a direct connection.
DuckDB aggregates the .dsv files locally; only the small results are POSTed in
gentle concurrent batches (we never push the raw 78M-row history).

  python3 scripts/load_pdq_supabase_rest.py                                   # all
  python3 scripts/load_pdq_supabase_rest.py lease_summary lease_production_recent

Re-runnable: each loaded table is cleared (DELETE all) before loading.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

import duckdb

from load_pdq_supabase import build_loads, latest_cycle_idx

SUPERAPP = Path(__file__).resolve().parents[1]

BATCH = 2000
WORKERS = 4
RETRY_CODES = {429, 500, 502, 503, 504, 520, 521, 522, 523, 524}
# A non-null, non-negative column per table, used to DELETE-all on a re-run.
CLEAR_COL = {
    "leases": "district_no",
    "well_lease": "id",
    "operator_production": "cycle",
    "lease_summary": "district_no",
    "lease_production_recent": "district_no",
}


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v
    return env


ENV = load_env(SUPERAPP / ".env.local")
BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = ENV["SUPABASE_SECRET_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def _request(method: str, url: str, body: bytes | None = None) -> None:
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    for attempt in range(9):
        try:
            with urllib.request.urlopen(req, timeout=300):
                return
        except urllib.error.HTTPError as e:
            if e.code in RETRY_CODES and attempt < 8:
                time.sleep(min(30, 2 ** attempt))
                continue
            raise RuntimeError(f"{method} {url} -> {e.code}: {e.read()[:300]!r}")
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt < 8:
                time.sleep(min(30, 2 ** attempt))
                continue
            raise


def post_batch(table: str, records: list[dict]) -> int:
    _request("POST", f"{BASE}/{table}", json.dumps(records).encode())
    return len(records)


def clear(table: str) -> None:
    _request("DELETE", f"{BASE}/{table}?{CLEAR_COL[table]}=gte.0")


def load_table(con, table: str, cols: str, sel: str) -> int:
    clear(table)
    colnames = cols.split(",")
    cur = con.execute(sel)
    total = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        pending: set = set()
        while True:
            rows = cur.fetchmany(BATCH)
            if not rows:
                break
            records = [dict(zip(colnames, r)) for r in rows]
            pending.add(ex.submit(post_batch, table, records))
            if len(pending) >= WORKERS * 2:
                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                total += sum(f.result() for f in done)
        for f in pending:
            total += f.result()
    return total


def main() -> int:
    only = set(sys.argv[1:])
    con = duckdb.connect()
    con.execute("pragma memory_limit='4GB'")
    con.execute(f"pragma temp_directory='{SUPERAPP / '.tiles-build'}'")
    cutoff = latest_cycle_idx(con) - 12
    for table, cols, sel in build_loads(cutoff):
        if only and table not in only:
            continue
        t = time.time()
        n = load_table(con, table, cols, sel)
        print(f"  {table}: {n:,} rows in {time.time() - t:.0f}s", flush=True)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
