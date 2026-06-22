-- 20260615000200_structured_summary.sql
-- Derived, structured representation of a parsed data file (LAS well logs, CSV
-- tables). The raw file is the source of truth in storage; this caches the
-- parsed header + per-column/curve summary stats so Orion can answer about a
-- dataset without re-parsing, and so the summary can be embedded for RAG.
--
-- Shape (jsonb), produced by lib/kb/parsers/structured.ts:
--   { "kind": "las" | "csv", ...parser-specific summary... }

alter table files add column structured_summary jsonb;
