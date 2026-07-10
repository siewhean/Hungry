-- Security audit remediation: private review media, review-photo owner policies,
-- and guest-session network rate-limit metadata.

alter table if exists public.guest_sessions
  add column if not exists client_ip text;

create index if not exists idx_guest_sessions_client_ip_created_at
  on public.guest_sessions(client_ip, created_at desc)
  where client_ip is not null;

alter table if exists public.review_photos
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
where id in ('menu-photos', 'review-media');

drop policy if exists "public_select_review_photos" on public.review_photos;
drop policy if exists "review_photos_select_public_reviews" on public.review_photos;
create policy "review_photos_select_public_reviews"
on public.review_photos for select to anon, authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
  )
);

drop policy if exists "review_photos_insert_own_review" on public.review_photos;
create policy "review_photos_insert_own_review"
on public.review_photos for insert to authenticated
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = auth.uid()
  )
  and coalesce(storage_bucket, 'review-media') = 'review-media'
  and coalesce(storage_path, url) like auth.uid()::text || '/%'
);

drop policy if exists "review_photos_update_own_review" on public.review_photos;
create policy "review_photos_update_own_review"
on public.review_photos for update to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = auth.uid()
  )
  and coalesce(storage_bucket, 'review-media') = 'review-media'
  and coalesce(storage_path, url) like auth.uid()::text || '/%'
);

drop policy if exists "review_photos_delete_own_review" on public.review_photos;
create policy "review_photos_delete_own_review"
on public.review_photos for delete to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "user_profiles_anon_deny" on public.user_profiles;
create policy "user_profiles_anon_deny"
on public.user_profiles for select to anon
using (false);

drop policy if exists "review_media_select_authenticated_own_prefix" on storage.objects;
drop policy if exists "review_media_select_signed_public_reviews" on storage.objects;
create policy "review_media_select_signed_public_reviews"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'review-media'
  and exists (
    select 1
    from public.review_photos rp
    where rp.storage_bucket = 'review-media'
      and rp.storage_path = storage.objects.name
  )
);

drop policy if exists "review_media_service_role_all" on storage.objects;
create policy "review_media_service_role_all"
on storage.objects for all to service_role
using (bucket_id = 'review-media')
with check (bucket_id = 'review-media');
