-- 20260615000200_task_deadlines.sql
-- Optional deadline for a task: a date, with an optional time-of-day.

alter table tasks add column deadline      date;
alter table tasks add column deadline_time time;   -- null = no specific time
