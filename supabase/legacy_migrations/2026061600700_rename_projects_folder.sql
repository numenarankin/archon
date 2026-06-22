-- 2026061600700_rename_projects_folder.sql
-- Rebrand the "Exploration" section to "Projects": rename the system folder that
-- holds project folders so it reads "Projects" in /files and matches the new
-- /projects route and the `name = 'Projects'` lookups in lib/projects. Fresh
-- databases already seed it as "Projects" (default_folders); this updates any
-- database seeded before the rename.
--
-- Idempotent.

update folders
set name = 'Projects'
where is_system = true and parent_folder_id is null and name = 'Exploration';
