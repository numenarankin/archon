-- 20260622000400_operator_contacts.sql
-- Enriched decision-maker contact data (email + phone) per operator, scored by
-- confidence so the outbound list can sort/threshold on it.
--
-- Populated by the enrichment pipeline (see plans/enrichment-build-plan.md):
-- select top decision-maker per operator -> Skip Trace PRO scraper ->
-- disambiguate against P-5 records -> score email_confidence -> upsert here.
-- RLS follows the app convention (authenticated-only, full access).

create table operator_contacts (
  operator_no       integer  not null,     -- joins operators.operator_number
  officer_name      text     not null,     -- who we targeted ("LAST, FIRST")
  person_key        text     not null,     -- normalize(last,first)+phone (dedup/cache)
  best_email        text,
  email_confidence  smallint,              -- 0-100, OUTBOUND SORT KEY
  email_grade       text,                  -- verified_active / verified_uncertain / none
  emails            jsonb,                 -- all candidate emails
  best_phone        text,                  -- E.164
  phone_type        text,                  -- mobile / landline
  phone_live        boolean,
  current_address   text,                  -- scraper-returned (solves PO-box gap)
  age               smallint,
  employer          text,
  occupation        text,
  match_basis       text,                  -- phone_namematch/name_k1/name_k2/name_k3/single/ambiguous/none
  match_confidence  smallint,              -- 0-100 attribution certainty
  sources           text[],
  raw               jsonb,                 -- full scraper payload (never re-pay)
  enriched_at       timestamptz default now(),
  primary key (operator_no, officer_name)
);

-- Sort key for the outbound list (highest-confidence emails first).
create index operator_contacts_confidence_idx
  on operator_contacts (email_confidence desc);
-- person_key groups the same human across the operators they run (one person
-- can be the decision-maker for several operators), and lets the enrichment job
-- reuse a person's scraper result instead of paying twice. NOT unique: we keep
-- one row per operator, since the per-well pitch is per operator.
create index operator_contacts_person_idx
  on operator_contacts (person_key);

alter table operator_contacts enable row level security;
create policy operator_contacts_authenticated on operator_contacts
  for all to authenticated using (true) with check (true);

-- Selection: top decision-maker per operator with > p_min_wells wells, shaped as
-- the scraper input (name + filer phone + per-row state). Pass p_operator to get
-- a single operator regardless of well count (the on-demand enrich path).
-- security invoker so it respects RLS.
create or replace function operators_for_enrichment(
  p_min_wells int default 20,
  p_operator  int default null
)
returns table (
  operator_no   integer,
  operator_name text,
  officer_name  text,   -- raw "LAST, FIRST" (stored on the contact row)
  search_name   text,   -- "First Last" (the scraper query)
  phone         text,   -- digits only, or null
  state         text,   -- 2-letter, never null (TX fallback)
  city          text,
  zip           integer,
  wells         bigint
)
language sql
stable
security invoker
as $$
  with counts as (
    select operator_number, count(*) as wells
    from well_operator
    where operator_number is not null and operator_number > 0
    group by operator_number
    having p_operator is not null
        or count(*) > p_min_wells
  ),
  ranked as (
    select c.operator_number,
           c.wells,
           off.officer_name,
           off.officer_city,
           off.officer_state,
           off.officer_zip,
           row_number() over (
             partition by c.operator_number
             order by
               case
                 when off.officer_title ilike '%OWNER%'        then 1
                 when off.officer_title ilike '%PRES%'         then 2
                 when off.officer_title ilike '%MANAG%MEMBER%' then 3
                 when off.officer_title ilike '%PARTNER%'      then 4
                 when off.officer_title ilike '%MEMBER%'       then 5
                 when off.officer_title ilike '%MANAG%'        then 6
                 when off.officer_title ilike '%CEO%'          then 7
                 else 9
               end,
               off.id
           ) as rn
    from counts c
    join operator_officers off on off.operator_number = c.operator_number
    where off.officer_name is not null
      and (off.officer_title ilike '%OWNER%'   or off.officer_title ilike '%PRES%'
        or off.officer_title ilike '%PARTNER%' or off.officer_title ilike '%MEMBER%'
        or off.officer_title ilike '%MANAG%'   or off.officer_title ilike '%CEO%')
  )
  select
    r.operator_number,
    o.operator_name,
    r.officer_name,
    -- "LAST, FIRST MIDDLE" -> "First Middle Last"; if no comma, use verbatim.
    case
      when position(',' in r.officer_name) > 0
        then btrim(split_part(r.officer_name, ',', 2)) || ' '
             || btrim(split_part(r.officer_name, ',', 1))
      else r.officer_name
    end as search_name,
    nullif(regexp_replace(coalesce(o.phone::text, ''), '\D', '', 'g'), '') as phone,
    coalesce(nullif(btrim(o.state), ''), nullif(btrim(r.officer_state), ''), 'TX') as state,
    coalesce(nullif(btrim(o.city), ''), nullif(btrim(r.officer_city), '')) as city,
    coalesce(o.zip, r.officer_zip) as zip,
    r.wells
  from ranked r
  join operators o on o.operator_number = r.operator_number
  where r.rn = 1
    and (p_operator is null or r.operator_number = p_operator)
  order by r.wells desc
$$;

-- The outbound list: enriched contacts at/above a confidence floor, best first.
create or replace function contacts_for_outbound(p_min_confidence smallint default 0)
returns table (
  operator_no      integer,
  operator_name    text,
  wells            bigint,
  officer_name     text,
  best_email       text,
  email_confidence smallint,
  email_grade      text,
  best_phone       text,
  phone_type       text,
  phone_live       boolean
)
language sql
stable
security invoker
as $$
  select
    oc.operator_no,
    o.operator_name,
    (select count(*) from well_operator wo where wo.operator_number = oc.operator_no) as wells,
    oc.officer_name,
    oc.best_email,
    oc.email_confidence,
    oc.email_grade,
    oc.best_phone,
    oc.phone_type,
    oc.phone_live
  from operator_contacts oc
  join operators o on o.operator_number = oc.operator_no
  where coalesce(oc.email_confidence, 0) >= coalesce(p_min_confidence, 0)
  order by oc.email_confidence desc nulls last
$$;

grant execute on function operators_for_enrichment(int, int) to anon, authenticated;
grant execute on function contacts_for_outbound(smallint)    to anon, authenticated;
