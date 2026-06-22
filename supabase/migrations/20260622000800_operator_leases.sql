-- 20260622000800_operator_leases.sql
-- Leases an operator's wells sit on, with last-12-month oil/gas and well count,
-- for the map operator panel's "Leases" tab. security invoker (respects RLS).
--
-- Keyed off the SAME wells the panel's Wells tab shows (well_operator -> the
-- permit/H-15 operator), bridged to leases via well_lease, so the two tabs stay
-- consistent. Production is attached from lease_summary (null if the lease has
-- no production records). well_count = distinct wells on the lease.

create or replace function operator_leases(p_operator integer)
returns table (
  oil_gas_code char(1),
  district_no  smallint,
  lease_no     integer,
  lease_name   text,
  well_count   integer,
  oil_last12   bigint,
  gas_last12   bigint,
  last_cycle   integer
)
language sql stable security invoker as $$
  with op_leases as (
    select distinct wl.oil_gas_code, wl.district_no, wl.lease_no
    from well_lease wl
    join well_operator wo on wo.api_number = wl.api_number
    where wo.operator_number = p_operator
  ),
  wc as (
    select wl.oil_gas_code, wl.district_no, wl.lease_no,
           count(distinct wl.api_number) as n
    from well_lease wl
    join op_leases using (oil_gas_code, district_no, lease_no)
    group by 1, 2, 3
  )
  select ol.oil_gas_code, ol.district_no, ol.lease_no,
         l.lease_name,
         coalesce(wc.n, 0)::integer as well_count,
         s.oil_last12, s.gas_last12, s.last_cycle
  from op_leases ol
  left join leases l        using (oil_gas_code, district_no, lease_no)
  left join lease_summary s using (oil_gas_code, district_no, lease_no)
  left join wc              using (oil_gas_code, district_no, lease_no)
  order by coalesce(s.gas_last12, 0) + coalesce(s.oil_last12, 0) desc,
           ol.lease_no
$$;

grant execute on function operator_leases(integer) to anon, authenticated;
