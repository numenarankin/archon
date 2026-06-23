-- 20260623000400_operator_network_v2.sql
-- Network view v2: show many more clusters in the overview.
--
-- v1 capped edges GLOBALLY and sorted by well count, so a few mega-hubs (CT
-- Corporation + major-operator officers) consumed the whole budget and the other
-- hubs rendered with no spokes (only ~5 visible clusters). v2:
--   * caps edges PER HUB (row_number per person), so every selected hub renders
--     its own cluster regardless of how big the others are;
--   * raises the hub limit (32 -> 100);
--   * adds p_min_wells (default 20) to drop the long tail of tiny one-well
--     operators, matching the operator-mode "wells operated" filter.
--
-- Signatures change, so drop the v1 overloads first (Postgres keys functions by
-- name + arg types; create-or-replace alone would leave a duplicate overload and
-- make PostgREST calls ambiguous).

drop function if exists network_hub_graph(text, int, int, int);
drop function if exists network_subgraph(text, int, int, int);

-- Default Network view: top hubs and their operators, capped per hub.
create or replace function network_hub_graph(
  p_role text default null,
  p_min_operators int default 3,
  p_hub_limit int default 100,
  p_min_wells int default 20,
  p_per_hub int default 18
) returns table (
  src_person text, operator_number int, operator_name text, officer_title text,
  p5_status text, op_wells int, person_operators int, hop int
) language sql stable security invoker as $$
  with hubs as (
    select pa.officer_name
    from mv_person_affiliations pa
    where pa.operator_count >= coalesce(p_min_operators, 3)
      and (p_role is null
        or (p_role = 'filing' and pa.is_filing_agent)
        or (p_role = 'agent'  and pa.is_agent))
    order by pa.total_wells desc
    limit coalesce(p_hub_limit, 100)
  ),
  edges as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, w.wells as op_wells
    from operator_officers oo
    join hubs h on h.officer_name = oo.officer_name
    join mv_operator_well_counts w on w.operator_number = oo.operator_number
    where oo.operator_number > 0
      and w.wells >= coalesce(p_min_wells, 0)
    group by oo.officer_name, oo.operator_number, w.wells
  ),
  ranked as (
    select e.*,
           row_number() over (partition by e.src_person order by e.op_wells desc) as rn
    from edges e
  )
  select r.src_person, r.operator_number, o.operator_name, r.officer_title,
         o.p5_status, r.op_wells,
         coalesce(pa.operator_count, 0)::int as person_operators, 0 as hop
  from ranked r
  join operators o on o.operator_number = r.operator_number
  left join mv_person_affiliations pa on pa.officer_name = r.src_person
  where r.rn <= coalesce(p_per_hub, 18)
  order by r.op_wells desc
$$;

-- Seeded subgraph (person / operator / county), with the same min-wells filter.
create or replace function network_subgraph(
  p_person text default null,
  p_operator int default null,
  p_county int default null,
  p_min_wells int default 20,
  p_edge_cap int default 1200
) returns table (
  src_person text, operator_number int, operator_name text, officer_title text,
  p5_status text, op_wells int, person_operators int, hop int
) language sql stable security invoker as $$
  with
  person_star as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where p_person is not null and oo.officer_name = p_person and oo.operator_number > 0
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
      and oo.operator_number <> p_operator and oo.operator_number > 0
    group by oo.officer_name, oo.operator_number
  ),
  county_ops as (
    select c.operator_number from (
      select operator_number, count(*) as wells
      from well_operator
      where p_county is not null
        and api_number >= p_county * 100000 and api_number < (p_county + 1) * 100000
        and operator_number > 0
      group by operator_number order by wells desc limit 60
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
         o.p5_status, coalesce(w.wells, 0)::int as op_wells,
         coalesce(pa.operator_count, 0)::int as person_operators, e.hop
  from edges e
  join operators o on o.operator_number = e.operator_number
  left join mv_operator_well_counts w on w.operator_number = e.operator_number
  left join mv_person_affiliations pa on pa.officer_name = e.src_person
  -- Always keep the focused operator itself; otherwise apply the min-wells floor.
  where coalesce(w.wells, 0) >= coalesce(p_min_wells, 0)
     or e.operator_number = p_operator
  order by e.hop, op_wells desc
  limit coalesce(p_edge_cap, 1200)
$$;

grant execute on function network_hub_graph(text, int, int, int, int) to anon, authenticated;
grant execute on function network_subgraph(text, int, int, int, int) to anon, authenticated;
