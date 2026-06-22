-- 20260621000700_tasks.sql
-- Kanban tasks. `assignee` is free-form text. A task can optionally be tagged to
-- a project (folder) and carry a budget/spend so the project Budget tab can be a
-- view over its tasks; untagged tasks just show on the global board. `deadline`
-- (+ optional time) drives the calendar's task-deadline surfacing.

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,                                  -- rich text (HTML)
  status        task_status   not null default 'planned',
  priority      task_priority not null default 'Medium',
  assignee      text,
  sort_order    numeric not null default 0,
  folder_id     uuid references folders (id) on delete set null,
  budget        numeric,
  spend         numeric,
  deadline      date,
  deadline_time time,                                  -- null = no specific time
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_status_order_idx on tasks (status, sort_order);
create index tasks_folder_id_idx    on tasks (folder_id);
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();
alter table tasks enable row level security;
create policy tasks_authenticated on tasks
  for all to authenticated using (true) with check (true);
