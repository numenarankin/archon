-- 20260615000100_well_coordinates.sql
-- Surface-location coordinates for a well (free-form text, e.g. "31.9686, -102.0779").

alter table wells add column coordinates text;
