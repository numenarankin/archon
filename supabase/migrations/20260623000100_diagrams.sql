-- 20260623000100_diagrams.sql
-- Diagrams: a new file TYPE for tldraw canvases. A diagram is a regular `files`
-- row (type='diagram') that lives in the folder where it was created — no new
-- tables or columns. The existing columns carry everything:
--   content            → the tldraw snapshot JSON (source of truth)
--   derived_content    → a generated text description of the graph (so Archon
--                        can read + search it like any other document)
--   structured_summary → the cached { nodes, edges, groups } graph for tools
--   storage_key        → (optional) an exported thumbnail
-- Only the type CHECK constraint is widened.
alter table files drop constraint files_type_check;
alter table files add constraint files_type_check
  check (type in ('pdf','doc','md','note','image','transcript','url','diagram'));
