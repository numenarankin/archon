#!/usr/bin/env python3
"""Export geocoded wells to line-delimited GeoJSON for tiling.

Reads the project's Parquet/DuckDB layer (built by the `wildcat` package) and
writes one GeoJSON Feature per line (GeoJSONSeq, which tippecanoe reads). Each
point carries only the small set of attributes the map needs for render, filter,
and operator highlight; rich detail is fetched from Supabase on click.

Output: wildcat-superapp/.tiles-build/wells.geojsonl
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

OUT = SUPERAPP / ".tiles-build" / "wells.geojsonl"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con = connect(ROOT / "parquet")
    # Coordinates + the baked tile attributes (operator_number enables the
    # client-side "highlight this operator's wells" filter).
    rows = con.sql("""
        select l.api_number, l.longitude, l.latitude,
               coalesce(s.oil_gas, '') as oil_gas,
               coalesce(s.admin_district, 0) as district,
               case when s.is_plugged then 1 else 0 end as plugged,
               coalesce(s.total_depth, 0) as depth,
               coalesce(o.operator_number, 0) as operator
        from well_location l
        join well_summary s using (api_number)
        left join well_operator o using (api_number)
        where l.latitude is not null and l.longitude is not null
    """).fetchnumpy()

    n = len(rows["api_number"])
    t = time.time()
    with open(OUT, "w") as f:
        for i in range(n):
            feat = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(rows["longitude"][i]), 6),
                                    round(float(rows["latitude"][i]), 6)],
                },
                "properties": {
                    "api": int(rows["api_number"][i]),
                    "og": rows["oil_gas"][i] or "",
                    "dist": int(rows["district"][i]),
                    "plug": int(rows["plugged"][i]),
                    "depth": int(rows["depth"][i]),
                    "op": int(rows["operator"][i]),
                },
            }
            f.write(json.dumps(feat, separators=(",", ":")))
            f.write("\n")
    size_mb = OUT.stat().st_size / 1e6
    print(f"wrote {n:,} features to {OUT} ({size_mb:.0f} MB) in {time.time()-t:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
