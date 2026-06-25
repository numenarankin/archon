-- 20260624000400_task_files.sql
-- Connects a task to knowledge-base documents (the files it relates to). A
-- task-scoped link table, modeled like file_tags: a many-to-many junction
-- between tasks and files, with FK cascades so links vanish when either side is
-- deleted. Read by the task modal (to seed + edit links), the board (to show a
-- linked-docs count), and Archon's list_tasks tool (so it can connect a task to
-- its supporting documents).
create table task_files (
  task_id    uuid not null references tasks (id) on delete cascade,
  file_id    uuid not null references files (id) on delete cascade,
  created_by text not null default 'user' check (created_by in ('user', 'ai')),
  created_at timestamptz not null default now(),
  primary key (task_id, file_id)
);

create index task_files_task_idx on task_files (task_id);
create index task_files_file_idx on task_files (file_id);
