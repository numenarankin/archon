-- 20260623000200_operator_network.sql
-- Operator/person network graph for the Map page "Network" view.
--
-- Models the P-5 data as a bipartite graph: people (officers, principals,
-- filing agents, resident agents) on one side, operators on the other, with one
-- edge per affiliation (operator_officers row). Operator node weight = wells
-- operated (customer value); person node weight = how many operators they
-- connect (network value). A person on many operators (a filing agent) is a hub
-- that bridges otherwise-separate operator clusters: the prospecting target.
--
-- Two materialized views precompute the weights/ranking so the graph RPCs are
-- cheap. REFRESH them after each data load (they read existing tables only):
--   refresh materialized view mv_operator_well_counts;
--   refresh materialized view mv_person_affiliations;   -- depends on the above
-- (or `refresh materialized view concurrently ...` once populated, thanks to the
-- unique indexes below).
--
-- Person identity here is the exact officer_name string, matching how
-- getPrincipalDetail already resolves "affiliated operators". A later pass can
-- upgrade this to operator_contacts.person_key where enriched data exists.

-- Wells operated per operator: the operator node weight + ranking input.
create materialized view if not exists mv_operator_well_counts as
  select operator_number, count(*)::int as wells
  from well_operator
  where operator_number > 0
  group by operator_number;

create unique index if not exists mv_operator_well_counts_pk
  on mv_operator_well_counts (operator_number);

-- Person rollup: distinct operators each person is listed on (degree = network
-- value), the summed wells of those operators (filing "volume"), and role flags
-- so the graph can be filtered to filing agents / agents.
create materialized view if not exists mv_person_affiliations as
  with edges as (
    -- One row per (person, operator): a person can hold several titles at one
    -- operator, which must not double-count their wells.
    select officer_name, operator_number
    from operator_officers
    where officer_name is not null and btrim(officer_name) <> ''
      and operator_number > 0
    group by officer_name, operator_number
  ),
  roles as (
    select officer_name,
           bool_or(officer_title ilike '%filing%agent%'
                   or officer_title ilike '%filing agent%') as is_filing_agent,
           bool_or(officer_title ilike '%agent%')           as is_agent
    from operator_officers
    where officer_name is not null and btrim(officer_name) <> ''
    group by officer_name
  )
  select e.officer_name,
         count(*)::int                         as operator_count,
         coalesce(sum(w.wells), 0)::bigint      as total_wells,
         coalesce(r.is_filing_agent, false)     as is_filing_agent,
         coalesce(r.is_agent, false)            as is_agent
  from edges e
  left join mv_operator_well_counts w on w.operator_number = e.operator_number
  left join roles r on r.officer_name = e.officer_name
  group by e.officer_name, r.is_filing_agent, r.is_agent;

create unique index if not exists mv_person_affiliations_pk
  on mv_person_affiliations (officer_name);
create index if not exists mv_person_affiliations_wells_idx
  on mv_person_affiliations (total_wells desc);

-- Top hubs: people ranked by filing volume / connectivity. This is the answer to
-- "which filing agents handle the most volume in Texas?" -> p_role => 'filing'.
create or replace function network_top_hubs(
  p_role text default null,          -- 'filing' | 'agent' | null (everyone)
  p_min_operators int default 2,
  p_limit int default 80
)
returns table (
  officer_name text,
  operator_count int,
  total_wells bigint,
  is_filing_agent boolean,
  is_agent boolean
)
language sql
stable
security invoker
as $$
  select pa.officer_name, pa.operator_count, pa.total_wells,
         pa.is_filing_agent, pa.is_agent
  from mv_person_affiliations pa
  where pa.operator_count >= coalesce(p_min_operators, 2)
    and (
      p_role is null
      or (p_role = 'filing' and pa.is_filing_agent)
      or (p_role = 'agent'  and pa.is_agent)
    )
  order by pa.total_wells desc, pa.operator_count desc
  limit coalesce(p_limit, 80)
$$;

-- Default Network view: the top hubs and the operators they connect, in one
-- shot. Operators shared by two hubs become the bridges between their clusters.
-- Returns a flat affiliation edge list; the client assembles nodes from it.
create or replace function network_hub_graph(
  p_role text default null,
  p_min_operators int default 3,
  p_hub_limit int default 40,
  p_edge_cap int default 1200
)
returns table (
  src_person text,
  operator_number int,
  operator_name text,
  officer_title text,
  p5_status text,
  op_wells int,
  person_operators int,
  hop int
)
language sql
stable
security invoker
as $$
  with hubs as (
    select pa.officer_name
    from mv_person_affiliations pa
    where pa.operator_count >= coalesce(p_min_operators, 3)
      and (
        p_role is null
        or (p_role = 'filing' and pa.is_filing_agent)
        or (p_role = 'agent'  and pa.is_agent)
      )
    order by pa.total_wells desc
    limit coalesce(p_hub_limit, 40)
  ),
  edges as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title
    from operator_officers oo
    where oo.officer_name in (select officer_name from hubs)
      and oo.operator_number > 0
    group by oo.officer_name, oo.operator_number
  )
  select e.src_person, e.operator_number, o.operator_name, e.officer_title,
         o.p5_status,
         coalesce(w.wells, 0)::int        as op_wells,
         coalesce(pa.operator_count, 0)::int as person_operators,
         0 as hop
  from edges e
  join operators o on o.operator_number = e.operator_number
  left join mv_operator_well_counts w on w.operator_number = e.operator_number
  left join mv_person_affiliations pa on pa.officer_name = e.src_person
  order by op_wells desc
  limit coalesce(p_edge_cap, 1200)
$$;

-- Seeded subgraph: focus on one person, one operator, or one county.
--  - person seed:   that person's full operator star (the "Palmour 199" cluster).
--  - operator seed: the people on it (hop 0) plus those people's OTHER operators
--                   (hop 1) so you can see who the filing agent also serves.
--  - county seed:   the top operators by wells in the county and their people.
create or replace function network_subgraph(
  p_person text default null,
  p_operator int default null,
  p_county int default null,
  p_edge_cap int default 800
)
returns table (
  src_person text,
  operator_number int,
  operator_name text,
  officer_title text,
  p5_status text,
  op_wells int,
  person_operators int,
  hop int
)
language sql
stable
security invoker
as $$
  with
  person_star as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where p_person is not null and oo.officer_name = p_person
      and oo.operator_number > 0
    group by oo.officer_name, oo.operator_number
  ),
  op_people as (
    select oo.officer_name as src_person, p_operator as operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where p_operator is not null and oo.operator_number = p_operator
      and oo.officer_name is not null and btrim(oo.officer_name) <> ''
    group by oo.officer_name
  ),
  op_expand as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 1 as hop
    from operator_officers oo
    where p_operator is not null
      and oo.officer_name in (select src_person from op_people)
      and oo.operator_number <> p_operator
      and oo.operator_number > 0
    group by oo.officer_name, oo.operator_number
  ),
  county_ops as (
    select c.operator_number
    from (
      select operator_number, count(*) as wells
      from well_operator
      where p_county is not null
        and api_number >= p_county * 100000
        and api_number <  (p_county + 1) * 100000
        and operator_number > 0
      group by operator_number
      order by wells desc
      limit 40
    ) c
  ),
  county_people as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where p_county is not null
      and oo.operator_number in (select operator_number from county_ops)
      and oo.officer_name is not null and btrim(oo.officer_name) <> ''
    group by oo.officer_name, oo.operator_number
  ),
  edges as (
    select * from person_star
    union all select * from op_people
    union all select * from op_expand
    union all select * from county_people
  )
  select e.src_person, e.operator_number, o.operator_name, e.officer_title,
         o.p5_status,
         coalesce(w.wells, 0)::int           as op_wells,
         coalesce(pa.operator_count, 0)::int as person_operators,
         e.hop
  from edges e
  join operators o on o.operator_number = e.operator_number
  left join mv_operator_well_counts w on w.operator_number = e.operator_number
  left join mv_person_affiliations pa on pa.officer_name = e.src_person
  order by e.hop, op_wells desc
  limit coalesce(p_edge_cap, 800)
$$;

grant execute on function network_top_hubs(text, int, int) to anon, authenticated;
grant execute on function network_hub_graph(text, int, int, int) to anon, authenticated;
grant execute on function network_subgraph(text, int, int, int) to anon, authenticated;
