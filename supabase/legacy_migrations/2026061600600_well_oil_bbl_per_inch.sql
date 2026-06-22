-- 2026061600600_well_oil_bbl_per_inch.sql
-- Per-well oil gauge conversion: barrels of oil per inch of gauge. Production
-- readings are entered in the units on the tank gauge (inches); the viewing UI
-- multiplies oil production / stock / sales by this ratio to display barrels.
-- Defaults to 1 (1:1, i.e. no conversion) for existing and new wells.
--
-- Append-only + idempotent.

alter table wells
  add column if not exists oil_bbl_per_inch numeric not null default 1;
