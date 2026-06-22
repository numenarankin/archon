-- 20260622000200_operator_search.sql
-- Functions so Archon can search/rank operators (PostgREST can't GROUP BY).
-- Both run on existing data (no reload needed) and respect RLS (security invoker).

-- Operators by mailing location (city and/or ZIP), filtered by total wells.
-- "operators in Graham, TX with > 30 wells"
create or replace function operators_by_location(
  p_city text default null,
  p_zip int default null,
  p_min int default 0,
  p_max int default null
)
returns table (
  operator_number int,
  operator_name text,
  city text,
  state text,
  zip int,
  phone bigint,
  wells bigint
)
language sql
stable
security invoker
as $$
  select q.operator_number, q.operator_name, q.city, q.state, q.zip, q.phone, q.wells
  from (
    select o.operator_number, o.operator_name, o.city, o.state, o.zip, o.phone,
           (select count(*) from well_operator wo
            where wo.operator_number = o.operator_number) as wells
    from operators o
    where (p_city is null or o.city ilike p_city)
      and (p_zip is null or o.zip = p_zip)
  ) q
  where q.wells >= coalesce(p_min, 0)
    and (p_max is null or q.wells <= p_max)
  order by q.wells desc
  limit 100
$$;

-- Operators that OPERATE wells in a county, ranked by wells operated there.
-- "operators with > 30 wells in Young County (code 503)"
create or replace function operators_in_county(
  p_county int,
  p_min int default 1
)
returns table (
  operator_number int,
  operator_name text,
  city text,
  state text,
  phone bigint,
  wells bigint
)
language sql
stable
security invoker
as $$
  select o.operator_number, o.operator_name, o.city, o.state, o.phone, c.wells
  from (
    select operator_number, count(*) as wells
    from well_operator
    where api_number >= p_county * 100000
      and api_number < (p_county + 1) * 100000
      and operator_number > 0
    group by operator_number
    having count(*) >= coalesce(p_min, 1)
  ) c
  join operators o on o.operator_number = c.operator_number
  order by c.wells desc
  limit 100
$$;

grant execute on function operators_by_location(text, int, int, int) to anon, authenticated;
grant execute on function operators_in_county(int, int) to anon, authenticated;
