-- 20260622001100_projects_root.sql
-- Seed the "Projects" system root folder.
--
-- The projects page (src/lib/projects/folders.ts, actions.ts) treats each
-- project as a child folder under a system folder named "Projects". The files
-- migration seeds no folders, so without this row createProject() throws
-- "Projects root folder not found". Idempotent: only inserts if missing.

insert into folders (name, is_system, parent_folder_id)
select 'Projects', true, null
where not exists (
  select 1 from folders where is_system = true and name = 'Projects'
);
