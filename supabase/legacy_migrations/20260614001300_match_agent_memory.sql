-- 20260614001200_match_agent_memory.sql
-- Semantic recall over Orion's user-level memory (the `recall` tool).

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
