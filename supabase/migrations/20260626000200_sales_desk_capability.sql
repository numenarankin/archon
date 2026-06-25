-- 20260626000200_sales_desk_capability.sql
-- Make the cold-calling desk a HARD per-member boundary, matching operator_contacts.
-- The sales_desk tables (20260626000100) scoped rows to workspace membership only,
-- so a member without the `view_prospects` capability could still read/write the
-- prospect list, call history, and transcripts via the API. Fold the capability
-- check into each policy so the page guard is no longer the only barrier.
--
-- Owners/admins implicitly hold every capability (see app_has_capability), so they
-- keep full access; a plain member needs `view_prospects` granted in Settings.
-- Depends on app_has_capability() from 20260625001100.

alter policy sales_prospects_rw on sales_prospects
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));

alter policy sales_config_rw on sales_config
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));

alter policy sales_calls_rw on sales_calls
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));

alter policy sales_call_lines_rw on sales_call_lines
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));

alter policy sales_follow_ups_rw on sales_follow_ups
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));

alter policy sales_outbound_numbers_rw on sales_outbound_numbers
  using (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'))
  with check (workspace_id in (select app_workspace_ids()) and app_has_capability('view_prospects'));
