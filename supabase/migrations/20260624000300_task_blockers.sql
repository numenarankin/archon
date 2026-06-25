-- 20260624000300_task_blockers.sql
-- Task dependencies: the tasks that must be completed before a task can proceed.
-- Stored inline as an array of blocker task ids on the task itself (one row per
-- task, matching the kanban model and the tool_names[] pattern in archon_skills).
-- Read by the board (to flag blocked cards) and by Archon's list_tasks tool, so
-- it can reason about completion order. The GIN index supports the reverse
-- lookup "what does this task block?" (blocked_by @> array[id]).
alter table tasks
  add column blocked_by uuid[] not null default '{}';

create index tasks_blocked_by_idx on tasks using gin (blocked_by);
