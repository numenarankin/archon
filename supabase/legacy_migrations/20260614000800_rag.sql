-- 20260614000800_rag.sql
-- Retrieval store for Orion: chunked, embedded document text + hybrid search.
--
-- Embedding dimension 1024 = Mistral `mistral-embed`. If you switch embedding
-- models, change the vector dimension here and re-embed the corpus.

create table document_chunks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references files (id) on delete cascade,
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1024),
  -- Generated full-text column for the keyword half of hybrid search.
  fts         tsvector generated always as (to_tsvector('english', content)) stored,
  metadata    jsonb not null default '{}'::jsonb,  -- file type, folder ids, etc.
  created_at  timestamptz not null default now(),
  unique (file_id, chunk_index)
);

-- ANN index for semantic search (cosine). Small corpus -> recall is ~exact.
create index document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);
-- Keyword index for the full-text half.
create index document_chunks_fts_idx
  on document_chunks using gin (fts);
create index document_chunks_file_idx
  on document_chunks (file_id);

-- Hybrid search: fuse semantic + keyword rankings with Reciprocal Rank Fusion.
-- The caller passes the query's embedding (computed app-side) and the raw text.
create or replace function match_document_chunks(
  query_embedding vector(1024),
  query_text      text,
  match_count     int default 10,
  rrf_k           int default 50
)
returns table (
  id       uuid,
  file_id  uuid,
  content  text,
  metadata jsonb,
  score    double precision
)
language sql
stable
as $$
  with semantic as (
    select dc.id,
           row_number() over (order by dc.embedding <=> query_embedding) as rank
    from document_chunks dc
    where dc.embedding is not null
    order by dc.embedding <=> query_embedding
    limit match_count * 2
  ),
  keyword as (
    select dc.id,
           row_number() over (
             order by ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from document_chunks dc
    where query_text <> ''
      and dc.fts @@ websearch_to_tsquery('english', query_text)
    limit match_count * 2
  )
  select dc.id,
         dc.file_id,
         dc.content,
         dc.metadata,
         coalesce(1.0 / (rrf_k + semantic.rank), 0.0)
       + coalesce(1.0 / (rrf_k + keyword.rank), 0.0) as score
  from document_chunks dc
  left join semantic on semantic.id = dc.id
  left join keyword  on keyword.id  = dc.id
  where semantic.id is not null or keyword.id is not null
  order by score desc
  limit match_count;
$$;
