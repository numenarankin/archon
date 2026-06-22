#!/usr/bin/env python3
"""Load the parsed RRC data into Supabase via the PostgREST API.

Uses only what's in .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY).
The secret/service key bypasses RLS, so bulk inserts are allowed. Rows are
streamed from the Parquet/DuckDB layer and POSTed in concurrent batches.

  python3 scripts/load_supabase_rest.py

Re-runnable: each table is cleared (DELETE all) before loading.
"""
from __future__ import annotations

import datetime
import json
import math
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

SUPERAPP = Path(__file__).resolve().parents[1]
ROOT = SUPERAPP.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(SUPERAPP / "scripts"))

from wildcat.db import connect  # noqa: E402
from load_supabase import LOADS  # reuse the validated SELECTs  # noqa: E402

BATCH = 2500
WORKERS = 4
# Primary-key column per table, used to delete-all on a re-run.
PK = {
    "operators": "operator_number",
    "operator_officers": "id",
    "wells": "api_number",
    "well_operator": "api_number",
    "permits": "id",
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


def _encode(v: object) -> object:
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def _request(method: str, url: str, body: bytes | None = None) -> None:
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=300):
                return
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 5:
                time.sleep(2 * (attempt + 1))
                continue
            raise RuntimeError(f"{method} {url} -> {e.code}: {e.read()[:300]!r}")
        except (urllib.error.URLError, TimeoutError, OSError):
            # socket read timeouts surface as builtin TimeoutError/OSError, not
            # HTTPError/URLError, so catch them too and retry.
            if attempt < 5:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def post_batch(table: str, records: list[dict]) -> int:
    body = json.dumps(records, default=_encode).encode()
    _request("POST", f"{BASE}/{table}", body)
    return len(records)


def clear(table: str) -> None:
    _request("DELETE", f"{BASE}/{table}?{PK[table]}=gte.0")


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
    only = set(sys.argv[1:])  # optional: only reload these tables, e.g. "operators"
    con = connect(ROOT / "parquet")
    for table, cols, sel in LOADS:
        if only and table not in only:
            continue
        t = time.time()
        n = load_table(con, table, cols, sel)
        print(f"  {table}: {n:,} rows in {time.time() - t:.0f}s", flush=True)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
