-- 20260626000500_sales_business_unit.sql
-- Split the sales desk by business unit and bridge it to the CRM.
--
-- Each sales_prospects row now belongs to a business unit, so /wildcat/sales and
-- /numena/sales show only their own prospects, and can link back to the durable
-- crm_accounts record it came from (the prospecting "add to CRM" enqueues the
-- issuer here as an Unscheduled prospect). RLS becomes the same business-unit
-- wall as the CRM (a Numena rep can't see Wildcat's prospects; owner/admin or a
-- crm_all_units holder sees both). The call/follow-up tables inherit that
-- visibility through their parent prospect, so they need no extra columns.
--
-- This SUPERSEDES 20260626000200 (which gated the sales tables on the Wildcat
-- 'view_sales' page capability — that would have blocked Numena reps from the
-- shared desk machinery). That migration is removed.

alter table sales_prospects
  add column if not exists business_unit_id uuid references business_units (id) on delete cascade,
  add column if not exists crm_account_id   uuid references crm_accounts (id)   on delete cascade;

-- Existing seeded prospects belong to WildcatIQ.
update sales_prospects p
set business_unit_id = (
  select bu.id from public.business_units bu
  join public.workspaces w on w.id = bu.workspace_id
  where bu.key = 'wildcat'
  order by w.created_at asc limit 1)
where business_unit_id is null;

create index if not exists sales_prospects_bu_queue_idx
  on sales_prospects (business_unit_id, queue_day, sort_order);
create index if not exists sales_prospects_crm_account_idx
  on sales_prospects (crm_account_id);

-- ── sales_prospects: the business-unit wall ─────────────────────────────────
drop policy if exists sales_prospects_rw on sales_prospects;
create policy sales_prospects_rw on sales_prospects
  for all to authenticated
  using (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')))
  with check (
    workspace_id in (select app_workspace_ids())
    and (business_unit_id in (select app_business_unit_ids())
         or app_has_capability('crm_all_units')));

-- ── calls / lines / follow-ups: inherit the prospect's visibility ───────────
-- (Orphaned-prospect calls — prospect deleted, prospect_id nulled — stay visible
-- so history survives.)
drop policy if exists sales_calls_rw on sales_calls;
create policy sales_calls_rw on sales_calls
  for all to authenticated
  using (
    prospect_id is null
    or exists (select 1 from sales_prospects p where p.id = sales_calls.prospect_id))
  with check (
    prospect_id is null
    or exists (select 1 from sales_prospects p where p.id = sales_calls.prospect_id));

drop policy if exists sales_call_lines_rw on sales_call_lines;
create policy sales_call_lines_rw on sales_call_lines
  for all to authenticated
  using (exists (select 1 from sales_calls c where c.id = sales_call_lines.call_id))
  with check (exists (select 1 from sales_calls c where c.id = sales_call_lines.call_id));

drop policy if exists sales_follow_ups_rw on sales_follow_ups;
create policy sales_follow_ups_rw on sales_follow_ups
  for all to authenticated
  using (
    prospect_id is null
    or exists (select 1 from sales_prospects p where p.id = sales_follow_ups.prospect_id))
  with check (
    prospect_id is null
    or exists (select 1 from sales_prospects p where p.id = sales_follow_ups.prospect_id));

-- sales_config and sales_outbound_numbers stay workspace-scoped (shared setup),
-- as created in 20260626000100.
