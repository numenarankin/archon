-- 20260622000900_operator_last12.sql
-- An operator's last-12-month oil + gas production totals, for the map operator
-- panel's P-5 profile.
--
-- Defined as the SUM of the leases shown in the panel's Leases tab (the leases
-- this operator's wells sit on), so the headline equals the table's column
-- totals. Uses the SAME op_leases derivation as operator_leases() to stay
-- consistent. (Note: this is the footprint of the operator's leases, which is
-- whole-lease production, not production attributed solely to this operator.)
-- security invoker (respects RLS).

create or replace function operator_last12(p_operator integer)
returns table (oil_last12 bigint, gas_last12 bigint)
language sql stable security invoker as $$
  with op_leases as (
    select distinct wl.oil_gas_code, wl.district_no, wl.lease_no
    from well_lease wl
    join well_operator wo on wo.api_number = wl.api_number
    where wo.operator_number = p_operator
  )
  select coalesce(sum(s.oil_last12), 0)::bigint,
         coalesce(sum(s.gas_last12), 0)::bigint
  from op_leases ol
  join lease_summary s using (oil_gas_code, district_no, lease_no)
$$;

grant execute on function operator_last12(integer) to anon, authenticated;
