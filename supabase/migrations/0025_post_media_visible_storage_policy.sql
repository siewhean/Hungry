-- Allow authenticated users to read private post-media objects when the
-- associated post is visible to them through the same post privacy function.

drop policy if exists "post_media_select_visible_post_objects" on storage.objects;
create policy "post_media_select_visible_post_objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.post_media pm
    where pm.storage_bucket = storage.objects.bucket_id
      and pm.storage_path = storage.objects.name
      and public.can_read_post(pm.post_id)
  )
);
