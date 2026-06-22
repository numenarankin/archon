-- 2026061702000_oil_readings_to_barrels.sql
-- Oil production readings used to be stored as gauge INCHES and converted to
-- barrels at read time (× the well's oil_bbl_per_inch). Conversion now happens at
-- WRITE time, so the column stores BARRELS and reads need no conversion. This
-- one-time backfill converts existing rows: oil_* × the well's ratio.
--
-- Only rows whose well has a ratio ≠ 1 change (ratio 1 is already 1:1). Gas and
-- salt water are untouched (already MCF / barrels).
--
-- NOT idempotent — it mutates values. Run exactly once.

update production_readings pr
set
  oil_production = pr.oil_production * coalesce(w.oil_bbl_per_inch, 1),
  oil_stock      = pr.oil_stock      * coalesce(w.oil_bbl_per_inch, 1),
  oil_sales      = pr.oil_sales      * coalesce(w.oil_bbl_per_inch, 1)
from wells w
where pr.well_id = w.id
  and coalesce(w.oil_bbl_per_inch, 1) <> 1;
