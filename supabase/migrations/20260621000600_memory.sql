-- 20260621000600_memory.sql
-- Two kinds of AI memory:
--   • agent_memory  — durable user-level facts/preferences (the remember/recall
--     tools), semantically searchable via pgvector.
--   • project_memory — one evolving, always-in-context summary per project
--     (folder), regenerated after each turn by the project agent.

create table agent_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users (id) on delete cascade,
  content    text not null,
  embedding  vector(1024),                 -- mistral-embed
  source     text not null default 'explicit'
    check (source in ('explicit', 'inferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_memory_user_idx on agent_memory (user_id);
create index agent_memory_embedding_idx
  on agent_memory using hnsw (embedding vector_cosine_ops);
create trigger agent_memory_set_updated_at
  before update on agent_memory
  for each row execute function set_updated_at();
alter table agent_memory enable row level security;
create policy agent_memory_authenticated on agent_memory
  for all to authenticated using (true) with check (true);

-- Semantic recall over user-level memory (the `recall` tool).
create or replace function match_agent_memory(
  query_embedding vector(1024),
  match_count     int default 5
)
returns table (
  id      uuid,
  content text,
  score   double precision
)
language sql
stable
as $$
  select m.id,
         m.content,
         1 - (m.embedding <=> query_embedding) as score
  from agent_memory m
  where m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

create table project_memory (
  folder_id  uuid primary key references folders (id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now()
);
create trigger project_memory_set_updated_at
  before update on project_memory
  for each row execute function set_updated_at();
alter table project_memory enable row level security;
create policy project_memory_authenticated on project_memory
  for all to authenticated using (true) with check (true);
