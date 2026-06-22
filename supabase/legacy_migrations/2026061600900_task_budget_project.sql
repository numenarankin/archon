-- 2026061600900_task_budget_project.sql
-- Tasks gain a project association + budget tracking. A task can be tagged to a
-- project (a folder under the Projects system root) via folder_id; budget/spend
-- let a task double as a project budget line — the project Budget tab is just a
-- view over the project's tasks that have a budget set. The global /tasks board
-- is unaffected: folder_id is nullable and untagged tasks still show there.
--
-- Append-only + idempotent: safe to run against a fresh or partially-migrated db.

alter table tasks
  add column if not exists folder_id uuid references folders (id) on delete set null;
alter table tasks add column if not exists budget numeric;
alter table tasks add column if not exists spend numeric;

create index if not exists tasks_folder_id_idx on tasks (folder_id);
