-- 20260625000800_storage_tenancy.sql
-- Phase 3f: scope the storage buckets by tenant via object-key prefix.
--   files          -> keyed  <workspace_id>/...   (org-shared)
--   budget-uploads -> keyed  <owner_id>/...        (user-private)
--   avatars        -> public read; write own prefix
--
-- These policies are defense-in-depth: the app's server actions read/write the
-- private buckets through the service-role client (which bypasses storage RLS)
-- AFTER verifying ownership of the corresponding row. They protect against any
-- direct browser->storage access. NEW uploads must use the prefixed keys (app
-- change in Phase 4); existing founder objects keep working via the admin path.
--
-- Path-prefix check compares the first folder segment of the object name. We cast
-- the known-uuid workspace ids to text (never the object segment to uuid) so a
-- legacy/non-uuid key can't raise a cast error inside the policy.

-- ── files: org-shared, prefix = workspace_id ────────────────────────────────
drop policy if exists files_bucket_authenticated on storage.objects;
create policy files_bucket_workspace on storage.objects
  for all to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] in (select w::text from app_workspace_ids() w))
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] in (select w::text from app_workspace_ids() w));

-- ── budget-uploads: user-private, prefix = owner_id ─────────────────────────
drop policy if exists budget_uploads_bucket_authenticated on storage.objects;
create policy budget_uploads_bucket_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'budget-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'budget-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text);

-- ── avatars: public bucket — anyone may read, users write their own prefix ──
drop policy if exists avatars_authenticated on storage.objects;
create policy avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');
create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);
