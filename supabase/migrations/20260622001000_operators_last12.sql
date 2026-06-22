-- 20260622001000_operators_last12.sql
-- Batch version of operator_last12: last-12-month oil + gas footprint totals for
-- a SET of operators at once, so the operator-cluster list can sort by oil/gas.
-- Same definition as operator_last12 (sum of the operator's leases). Operators
-- with no producing leases are simply absent from the result (treat as 0).
-- security invoker (respects RLS).

create or replace function operators_last12(p_operators integer[])
returns table (operator_no integer, oil_last12 bigint, gas_last12 bigint)
language sql stable security invoker as $$
  with op_leases as (
    select distinct wo.operator_number as operator_no,
           wl.oil_gas_code, wl.district_no, wl.lease_no
    from well_operator wo
    join well_lease wl on wl.api_number = wo.api_number
    where wo.operator_number = any(p_operators)
  )
  select ol.operator_no,
         coalesce(sum(s.oil_last12), 0)::bigint,
         coalesce(sum(s.gas_last12), 0)::bigint
  from op_leases ol
  join lease_summary s using (oil_gas_code, district_no, lease_no)
  group by ol.operator_no
$$;

grant execute on function operators_last12(integer[]) to anon, authenticated;
