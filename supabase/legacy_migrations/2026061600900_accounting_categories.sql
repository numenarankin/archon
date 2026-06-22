-- 2026061600900_accounting_categories.sql
-- Per-organization chart of accounts for the accounting feature. Stored as a
-- JSON array of { code, label, kind } on the org row. Null = use the built-in
-- default sample categories. Reads follow the org's existing RLS (any member);
-- writes are owner-gated by the organizations_write policy.

alter table organizations
  add column if not exists accounting_categories jsonb;
