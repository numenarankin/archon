#!/usr/bin/env python3
"""Export operator points (placed at their mailing-ZIP centroid) for the map's
operator mode.

Each operator that has at least one well and a resolvable ZIP becomes a point
with its name, address, and well count. Written as a compact JSON array; the map
builds GeoJSON from it client-side so it can re-cluster on the well-count filter.

Output: wildcat-superapp/public/operators.json
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

SUPERAPP = Path(__file__).resolve().parents[1]
ROOT = SUPERAPP.parent
sys.path.insert(0, str(ROOT / "src"))

from wildcat.db import connect  # noqa: E402

ZIP_CSV = ROOT / "wildcat-data" / "zip_latlng.csv"
OUT = SUPERAPP / "public" / "operators.json"


def main() -> int:
    con = connect(ROOT / "parquet")
    con.execute(
        "create or replace view ziploc as select lpad(ZIP,5,'0') zip, "
        f"LAT::double lat, LNG::double lng from read_csv('{ZIP_CSV.as_posix()}', header=true)"
    )
    con.execute(
        "create or replace temp view opcount as "
        "select operator_number, count(*) wells from well_operator group by 1"
    )
    rows = con.sql(
        """
        select o.operator_number opnum, o.operator_name opname,
               o.addr_line1 addr, o.city, o.state, o.zip,
               z.lng, z.lat, c.wells
        from operators o
        join opcount c on c.operator_number = o.operator_number
        join ziploc z on z.zip = lpad(o.zip::varchar, 5, '0')
        where c.wells >= 1
        order by c.wells desc
        """
    ).fetchnumpy()

    n = len(rows["opnum"])
    t = time.time()
    out = []
    for i in range(n):
        out.append({
            "n": int(rows["opnum"][i]),
            "nm": rows["opname"][i] or "",
            "a": rows["addr"][i] or "",
            "c": rows["city"][i] or "",
            "s": rows["state"][i] or "",
            "z": int(rows["zip"][i]) if rows["zip"][i] is not None else 0,
            "lng": round(float(rows["lng"][i]), 5),
            "lat": round(float(rows["lat"][i]), 5),
            "w": int(rows["wells"][i]),
        })
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {n:,} operator points to {OUT} "
          f"({OUT.stat().st_size / 1e6:.1f} MB) in {time.time() - t:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
