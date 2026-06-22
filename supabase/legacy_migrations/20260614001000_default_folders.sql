-- 20260614001000_default_folders.sql
-- Default top-level folders the app and Orion rely on being present (well files,
-- chat attachments, projects, and the standard document areas).
-- Marked is_system so the UI protects them from deletion/rename.
--
-- Idempotent: only inserts a top-level folder when one of that name doesn't
-- already exist, so it is safe to run even if some were added manually.

insert into folders (name, is_system, parent_folder_id)
select v.name, true, null
from (
  values
    ('Wells'),
    ('Chat Attachments'),
    ('Projects'),
    ('Knowledge Base'),
    ('Land & Leases'),
    ('Regulatory'),
    ('Accounting'),
    ('Legal')
) as v(name)
where not exists (
  select 1 from folders f
  where f.name = v.name and f.parent_folder_id is null
);
