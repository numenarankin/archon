-- 20260622000100_operator_phone.sql
-- Add the P-5 organization phone number to operators
-- (OROR-PHONE-NUMBER, 10 digits; 0 = none on file).
alter table operators add column if not exists phone bigint;
