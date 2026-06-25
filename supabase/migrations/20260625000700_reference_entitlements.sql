-- 20260625000700_reference_entitlements.sql
-- Phase 3e: gate the shared RRC reference data and enrichment PII behind
-- workspace entitlements instead of "any authenticated user". These tables are
-- read-only to users (loaded by service-role ETL, which bypasses RLS), so each
-- gets a SELECT-only policy and no write policy.
--
--   rrc_data    -> wells, operators, operator_officers, well_operator, permits,
--                  leases, well_lease, operator_production, lease_summary,
--                  lease_production_recent  (+ the network graph)
--   enrichment  -> operator_contacts
--
-- Functions that read only base tables (operators_*, well_production_*,
-- operator_leases, contacts_for_outbound, ...) are security-invoker, so the
-- policies below gate them automatically. The network_* functions read
-- MATERIALIZED VIEWS, which RLS does not cover, so they are handled explicitly:
-- direct MV access is revoked and the functions become SECURITY DEFINER with an
-- in-body entitlement guard.

-- ── RRC tables: SELECT only, gated on rrc_data ──────────────────────────────
drop policy if exists wells_authenticated               on wells;
drop policy if exists operators_authenticated           on operators;
drop policy if exists operator_officers_authenticated   on operator_officers;
drop policy if exists well_operator_authenticated        on well_operator;
drop policy if exists permits_authenticated             on permits;
drop policy if exists leases_authenticated              on leases;
drop policy if exists well_lease_authenticated          on well_lease;
drop policy if exists operator_production_authenticated on operator_production;
drop policy if exists lease_summary_authenticated       on lease_summary;
drop policy if exists lease_prod_recent_authenticated   on lease_production_recent;

create policy wells_rrc_read               on wells               for select to authenticated using (app_has_entitlement('rrc_data'));
create policy operators_rrc_read           on operators           for select to authenticated using (app_has_entitlement('rrc_data'));
create policy operator_officers_rrc_read   on operator_officers   for select to authenticated using (app_has_entitlement('rrc_data'));
create policy well_operator_rrc_read        on well_operator       for select to authenticated using (app_has_entitlement('rrc_data'));
create policy permits_rrc_read             on permits             for select to authenticated using (app_has_entitlement('rrc_data'));
create policy leases_rrc_read              on leases              for select to authenticated using (app_has_entitlement('rrc_data'));
create policy well_lease_rrc_read          on well_lease          for select to authenticated using (app_has_entitlement('rrc_data'));
create policy operator_production_rrc_read on operator_production for select to authenticated using (app_has_entitlement('rrc_data'));
create policy lease_summary_rrc_read       on lease_summary       for select to authenticated using (app_has_entitlement('rrc_data'));
create policy lease_prod_recent_rrc_read   on lease_production_recent for select to authenticated using (app_has_entitlement('rrc_data'));

-- ── Enrichment PII: SELECT only, gated on enrichment ────────────────────────
drop policy if exists operator_contacts_authenticated on operator_contacts;
create policy operator_contacts_read on operator_contacts
  for select to authenticated using (app_has_entitlement('enrichment'));

-- ── Detail view: ensure it runs with the caller's RLS, not the owner's ──────
alter view well_operator_detail set (security_invoker = on);

-- ── Materialized views: no direct API access ───────────────────────────────
-- RLS does not apply to MVs, so block direct reads; the network_* definer
-- functions below are the only sanctioned path (and they gate on entitlement).
revoke select on mv_operator_well_counts from anon, authenticated;
revoke select on mv_person_affiliations  from anon, authenticated;

-- ── network_* functions: SECURITY DEFINER + entitlement guard ───────────────
-- Same query logic as 20260623000400 (v2), now definer (so they can still read
-- the MVs after the revoke) with `app_has_entitlement('rrc_data')` added to the
-- driving filter so a non-entitled caller gets zero rows. auth.uid() inside the
-- guard still reflects the real caller, not the function owner.

create or replace function network_top_hubs(
  p_role text default null,
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
security definer
set search_path = public, pg_temp
as $$
  select pa.officer_name, pa.operator_count, pa.total_wells,
         pa.is_filing_agent, pa.is_agent
  from mv_person_affiliations pa
  where app_has_entitlement('rrc_data')
    and pa.operator_count >= coalesce(p_min_operators, 2)
    and (
      p_role is null
      or (p_role = 'filing' and pa.is_filing_agent)
      or (p_role = 'agent'  and pa.is_agent)
    )
  order by pa.total_wells desc, pa.operator_count desc
  limit coalesce(p_limit, 80)
$$;

create or replace function network_hub_graph(
  p_role text default null,
  p_min_operators int default 3,
  p_hub_limit int default 100,
  p_min_wells int default 20,
  p_per_hub int default 18
) returns table (
  src_person text, operator_number int, operator_name text, officer_title text,
  p5_status text, op_wells int, person_operators int, hop int
) language sql stable security definer set search_path = public, pg_temp as $$
  with hubs as (
    select pa.officer_name
    from mv_person_affiliations pa
    where app_has_entitlement('rrc_data')
      and pa.operator_count >= coalesce(p_min_operators, 3)
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

create or replace function network_subgraph(
  p_person text default null,
  p_operator int default null,
  p_county int default null,
  p_min_wells int default 20,
  p_edge_cap int default 1200
) returns table (
  src_person text, operator_number int, operator_name text, officer_title text,
  p5_status text, op_wells int, person_operators int, hop int
) language sql stable security definer set search_path = public, pg_temp as $$
  with
  gate as (select app_has_entitlement('rrc_data') as ok),
  person_star as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where (select ok from gate)
      and p_person is not null and oo.officer_name = p_person and oo.operator_number > 0
    group by oo.officer_name, oo.operator_number
  ),
  op_people as (
    select oo.officer_name as src_person, p_operator as operator_number,
           min(oo.officer_title) as officer_title, 0 as hop
    from operator_officers oo
    where (select ok from gate)
      and p_operator is not null and oo.operator_number = p_operator
      and oo.officer_name is not null and btrim(oo.officer_name) <> ''
    group by oo.officer_name
  ),
  op_expand as (
    select oo.officer_name as src_person, oo.operator_number,
           min(oo.officer_title) as officer_title, 1 as hop
    from operator_officers oo
    where (select ok from gate)
      and p_operator is not null
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
    where (select ok from gate)
      and p_county is not null
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
  where coalesce(w.wells, 0) >= coalesce(p_min_wells, 0)
     or e.operator_number = p_operator
  order by e.hop, op_wells desc
  limit coalesce(p_edge_cap, 1200)
$$;

-- Authenticated only (anon never has an entitlement anyway).
revoke execute on function network_top_hubs(text, int, int)            from anon;
revoke execute on function network_hub_graph(text, int, int, int, int) from anon;
revoke execute on function network_subgraph(text, int, int, int, int)  from anon;
grant  execute on function network_top_hubs(text, int, int)            to authenticated;
grant  execute on function network_hub_graph(text, int, int, int, int) to authenticated;
grant  execute on function network_subgraph(text, int, int, int, int)  to authenticated;
