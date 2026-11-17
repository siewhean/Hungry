-- Sprint 10 Phase A: OCR-02 storage provisioning
-- - Create/lock down menu-photos bucket
-- - Enforce authenticated user path ownership (<uid>/...)
-- - Allow service_role reads for OCR edge function ingestion
-- Safe to re-run (idempotent).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "menu_photos_insert_authenticated_own_prefix" on storage.objects;
create policy "menu_photos_insert_authenticated_own_prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'menu-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "menu_photos_update_authenticated_own_prefix" on storage.objects;
create policy "menu_photos_update_authenticated_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'menu-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'menu-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "menu_photos_delete_authenticated_own_prefix" on storage.objects;
create policy "menu_photos_delete_authenticated_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'menu-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "menu_photos_select_service_role_only" on storage.objects;
create policy "menu_photos_select_service_role_only"
on storage.objects
for select
to service_role
using (bucket_id = 'menu-photos');
