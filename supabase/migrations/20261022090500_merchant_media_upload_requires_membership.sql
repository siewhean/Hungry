-- merchant-L17: the public merchant image buckets accepted uploads from any signed-in user
-- under their own uid prefix. Uploading to merchant-dish-images / merchant-stall-images now also
-- needs an active merchant membership. post-media is unchanged.

create schema if not exists app_private;

create or replace function app_private.current_user_is_merchant_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from public.merchant_accounts ma where ma.user_id = auth.uid())
    or exists (select 1 from public.merchant_roles mr where mr.user_id = auth.uid())
    or exists (
      select 1
      from public.merchant_members mm
      where mm.user_id = auth.uid()
        and mm.status = 'active'
    );
$$;

revoke all on function app_private.current_user_is_merchant_member() from public, anon;
grant execute on function app_private.current_user_is_merchant_member()
  to authenticated, service_role;

drop policy if exists "integration_media_insert_authenticated_own_prefix" on storage.objects;
create policy "integration_media_insert_authenticated_own_prefix"
on storage.objects for insert to authenticated
with check (
  (storage.foldername(name))[1] = auth.uid()::text
  and (
    bucket_id = 'post-media'
    or (
      bucket_id in ('merchant-dish-images', 'merchant-stall-images')
      and app_private.current_user_is_merchant_member()
    )
  )
);
