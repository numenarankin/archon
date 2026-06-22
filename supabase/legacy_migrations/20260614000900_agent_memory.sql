-- 20260614000900_agent_memory.sql
-- User-level memory: durable facts and preferences Orion learns over time
-- ("always wants rates in bbl/d", "calls it the Henderson lease"). Backed by
-- pgvector so `recall` is a semantic lookup. Separate from document_chunks
-- (that's the corpus; this is what Orion remembers about the user).

create table agent_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users (id) on delete cascade,
  content    text not null,
  embedding  vector(1024),               -- mistral-embed
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
