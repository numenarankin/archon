-- 20260614000700_tasks.sql
-- Kanban tasks.
--
-- `assignee` is kept as free-form text for now because current assignees mix
-- people and teams ("Geology", "Field", "Accounting"). TODO: decide whether to
-- model assignees as users, teams, or both, then convert to a FK.

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,                              -- rich text (HTML)
  status      task_status   not null default 'planned',
  priority    task_priority not null default 'Medium',
  assignee    text,
  sort_order  numeric not null default 0,        -- ordering within a column
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();
create index tasks_status_order_idx on tasks (status, sort_order);
