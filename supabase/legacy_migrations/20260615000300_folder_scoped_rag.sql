-- 20260615000300_folder_scoped_rag.sql
-- Folder-scoped hybrid search. Extends match_document_chunks with an optional
-- `folder_ids` filter so a project's chat retrieves only from its
-- own documents (via file_placements). NULL/empty = search the whole corpus,
-- preserving the global /orion behaviour.

drop function if exists match_document_chunks(vector(1024), text, int, int);

create or replace function match_document_chunks(
  query_embedding vector(1024),
  query_text      text,
  match_count     int default 10,
  rrf_k           int default 50,
  folder_ids      uuid[] default null
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
  with allowed as (
    select dc.id
    from document_chunks dc
    where folder_ids is null
       or array_length(folder_ids, 1) is null
       or exists (
         select 1 from file_placements fp
         where fp.file_id = dc.file_id
           and fp.folder_id = any(folder_ids)
       )
  ),
  semantic as (
    select dc.id,
           row_number() over (order by dc.embedding <=> query_embedding) as rank
    from document_chunks dc
    where dc.embedding is not null
      and dc.id in (select id from allowed)
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
      and dc.id in (select id from allowed)
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
