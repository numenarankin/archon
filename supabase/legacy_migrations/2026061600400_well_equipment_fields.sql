-- 2026061600400_well_equipment_fields.sql
-- Generalize well_equipment from a fixed (name / type / status / installed_at)
-- shape into a flexible label/value/position attribute model: a well's
-- "equipment" is now an ordered list of field rows (e.g. a wellbore / tubing /
-- rod / casing spec sheet). The standard fields are offered as defaults in the
-- Add Equipment modal; the user can add arbitrary rows for anything not among
-- the defaults.
--
-- Append-only + idempotent: safe to run against a fresh or partially-migrated db.

alter table well_equipment add column if not exists label text;
alter table well_equipment add column if not exists value text;
alter table well_equipment
  add column if not exists position integer not null default 0;

-- Fold any existing rows' old shape into the new columns so they still render.
update well_equipment set label = name where label is null and name is not null;
update well_equipment set value = coalesce(type, '') where value is null;

-- The flexible model no longer requires the legacy name column on insert.
alter table well_equipment alter column name drop not null;

create index if not exists well_equipment_well_pos_idx
  on well_equipment (well_id, position);
