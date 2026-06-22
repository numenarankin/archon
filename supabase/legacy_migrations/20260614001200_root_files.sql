-- 20260614001200_root_files.sql
-- Allow files and folders to live at the root of the Files tree. The UI's
-- "root" is synthetic (no folder row); a null folder_id / parent means root.
--
-- file_placements.folder_id was NOT NULL, which made creating a doc or
-- uploading a file at the top level impossible. Relax it and guard against the
-- same file being placed at root twice (the existing unique(file_id, folder_id)
-- constraint treats NULLs as distinct).

alter table file_placements alter column folder_id drop not null;

create unique index if not exists file_placements_root_unique
  on file_placements (file_id)
  where folder_id is null;
