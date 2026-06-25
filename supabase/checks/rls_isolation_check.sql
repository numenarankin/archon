-- rls_isolation_check.sql
-- Run in the Supabase SQL editor AFTER applying the 20260625* migrations to
-- confirm the multi-tenant isolation is in place. Every query should return the
-- expected result described above it. This is the standing assertion for "no
-- table is left wide open".

-- 1) NO public table may keep a permissive `using (true)` ALL/SELECT policy,
--    except the intentional public-reference allowlist. Expect ZERO rows.
select p.schemaname, p.tablename, p.policyname, p.cmd, p.qual
from pg_policies p
where p.schemaname = 'public'
  and coalesce(p.qual, 'true') = 'true'            -- unrestricted read
  and p.tablename not in (
    'agent_context_templates'   -- pristine default docs, read-only reference
  )
order by p.tablename;

-- 2) Every public table must have RLS enabled. Expect ZERO rows.
select n.nspname, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by c.relname;

-- 3) Tenant columns landed and are NOT NULL on the key tables. Expect every row
--    to show is_nullable = 'NO'.
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name in ('conversations','agent_memory','budget_uploads','budget_transactions',
                    'profile','agent_context_docs','integration_settings') and column_name in ('owner_id','user_id'))
    or (table_name in ('folders','files','tasks','archon_skills','tags') and column_name = 'workspace_id')
  )
order by table_name, column_name;

-- 4) The materialized views must NOT be directly selectable by authenticated.
--    Expect ZERO rows (no select privilege for anon/authenticated on the MVs).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('mv_operator_well_counts','mv_person_affiliations')
  and grantee in ('anon','authenticated')
  and privilege_type = 'SELECT';

-- 5) The reference RPCs and helpers: network_* must be SECURITY DEFINER (to read
--    the MVs after the revoke); the app_* helpers likewise. Expect prosecdef = true
--    for all listed. (Everything else stays invoker.)
select p.proname, p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('network_top_hubs','network_hub_graph','network_subgraph',
                    'app_workspace_ids','app_default_workspace_id','app_workspace_role',
                    'app_has_entitlement','seed_agent_context')
order by p.proname;
