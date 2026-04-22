-- Sprint 10 Phase A follow-up:
-- Allow authenticated users to select only their own objects in menu-photos.
-- Needed for storage upload flows that perform existence checks with upsert=true.
-- Safe to re-run (idempotent).

drop policy if exists "menu_photos_select_authenticated_own_prefix" on storage.objects;
create policy "menu_photos_select_authenticated_own_prefix"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'menu-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
