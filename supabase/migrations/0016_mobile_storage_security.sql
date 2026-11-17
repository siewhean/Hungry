-- Mobile media storage hardening.
-- - Provision every bucket used by the mobile app.
-- - Keep write access scoped to authenticated <uid>/ prefixes.
-- - Re-harden submit_menu_photo so metadata paths must match the caller prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-photos', 'menu-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic']),
  ('review-media', 'review-media', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('avatars', 'avatars', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('bites-media', 'bites-media', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "review_media_insert_authenticated_own_prefix" on storage.objects;
create policy "review_media_insert_authenticated_own_prefix"
on storage.objects for insert to authenticated
with check (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "review_media_update_authenticated_own_prefix" on storage.objects;
create policy "review_media_update_authenticated_own_prefix"
on storage.objects for update to authenticated
using (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "review_media_delete_authenticated_own_prefix" on storage.objects;
create policy "review_media_delete_authenticated_own_prefix"
on storage.objects for delete to authenticated
using (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "review_media_select_authenticated_own_prefix" on storage.objects;
create policy "review_media_select_authenticated_own_prefix"
on storage.objects for select to authenticated
using (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_insert_authenticated_own_prefix" on storage.objects;
create policy "avatars_insert_authenticated_own_prefix"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_authenticated_own_prefix" on storage.objects;
create policy "avatars_update_authenticated_own_prefix"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_authenticated_own_prefix" on storage.objects;
create policy "avatars_delete_authenticated_own_prefix"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_select_authenticated_own_prefix" on storage.objects;
create policy "avatars_select_authenticated_own_prefix"
on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bites_media_insert_authenticated_own_prefix" on storage.objects;
create policy "bites_media_insert_authenticated_own_prefix"
on storage.objects for insert to authenticated
with check (bucket_id = 'bites-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bites_media_update_authenticated_own_prefix" on storage.objects;
create policy "bites_media_update_authenticated_own_prefix"
on storage.objects for update to authenticated
using (bucket_id = 'bites-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'bites-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bites_media_delete_authenticated_own_prefix" on storage.objects;
create policy "bites_media_delete_authenticated_own_prefix"
on storage.objects for delete to authenticated
using (bucket_id = 'bites-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bites_media_select_authenticated_own_prefix" on storage.objects;
create policy "bites_media_select_authenticated_own_prefix"
on storage.objects for select to authenticated
using (bucket_id = 'bites-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "mobile_media_select_service_role" on storage.objects;
create policy "mobile_media_select_service_role"
on storage.objects for select to service_role
using (bucket_id in ('menu-photos', 'review-media', 'avatars', 'bites-media'));

create or replace function submit_menu_photo(
  p_venue_id     text,
  p_storage_path text,
  p_content_type text,
  p_size_bytes   integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id text;
  v_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_storage_path is null or p_storage_path not like v_user_id::text || '/%' then
    raise exception 'storage path must start with authenticated user id' using errcode = '42501';
  end if;

  select building_id into v_building_id
    from venues
    where id = p_venue_id;

  if v_building_id is null then
    raise exception 'unknown venue: %', p_venue_id using errcode = '22023';
  end if;

  insert into menu_photo_submissions (
    venue_id, building_id, submitted_by,
    storage_path, content_type, size_bytes
  ) values (
    p_venue_id, v_building_id, v_user_id,
    p_storage_path, p_content_type, p_size_bytes
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function submit_menu_photo(text, text, text, integer) from public;
grant execute on function submit_menu_photo(text, text, text, integer) to authenticated;
