-- 20260615000500_project_memory.sql
-- Curated, always-in-context memory for a project's agent. One
-- evolving summary per project (folder): the agent's distilled understanding of
-- the project's conversation history — working model, decisions, open questions,
-- and clearly-labelled provisional hypotheses.
--
-- This is the project-scoped agent's memory; it is intentionally separate from
-- the platform-wide `agent_memory` (user-level facts/preferences). The summary
-- is regenerated from the prior memory + the latest conversation after each turn
-- (see lib/ai/project-memory.ts). Bias-typing (established vs provisional) is
-- enforced in the summariser prompt and respected by the project page prompt.

create table project_memory (
  folder_id  uuid primary key references folders (id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

create trigger project_memory_set_updated_at
  before update on project_memory
  for each row execute function set_updated_at();
