-- Orphan post drafts and unreferenced review/post media (reviews-posting-M15).
--
-- A post is inserted as a draft, its media uploaded, and only then published. A
-- failure in between (and a review insert refused after its photos uploaded) used
-- to leave a draft row or storage objects nobody references. The app now cleans up
-- after itself and retries with a client id, but an app killed mid-publish cannot,
-- so a scheduled Edge Function (purge-orphan-media) removes what is left:
--   1. public.purge_orphan_post_drafts(): deletes draft posts older than 24 hours
--      (post_media rows go with them).
--   2. public.list_orphan_media_objects(bucket): storage paths in review-media or
--      post-media older than 24 hours that no review_photos / post_media row uses.
-- The Edge Function removes the files through the Storage API (deleting storage.objects
-- rows from SQL would leave the files themselves behind).
--
-- Both functions are service_role only. The job URL and token live in Vault, never in
-- this file, like the account-deletion worker (20261017130000):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/purge-orphan-media', 'orphan_media_worker_url');
--   select vault.create_secret('<ORPHAN_MEDIA_WORKER_TOKEN>', 'orphan_media_worker_token');
-- Until both secrets exist the job is a no-op.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.purge_orphan_post_drafts(
  p_older_than interval default interval '24 hours'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  -- Never reach back less than an hour: an upload in progress is not an orphan.
  if p_older_than < interval '1 hour' then
    p_older_than := interval '1 hour';
  end if;
  with removed as (
    delete from public.posts
    where status = 'draft'
      and created_at < now() - p_older_than
    returning id
  )
  select count(*)::integer into v_count from removed;
  return v_count;
end;
$$;

create or replace function public.list_orphan_media_objects(
  p_bucket text,
  p_older_than interval default interval '24 hours',
  p_limit integer default 200
)
returns table (name text)
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if p_bucket not in ('review-media', 'post-media') then
    raise exception 'unsupported bucket' using errcode = '22023';
  end if;
  if p_older_than < interval '1 hour' then
    p_older_than := interval '1 hour';
  end if;

  if p_bucket = 'review-media' then
    return query
    select o.name
    from storage.objects o
    where o.bucket_id = 'review-media'
      and o.created_at < now() - p_older_than
      and not exists (
        select 1
        from public.review_photos rp
        where rp.storage_path = o.name
          and coalesce(rp.storage_bucket, 'review-media') = 'review-media'
      )
    order by o.created_at
    limit least(greatest(p_limit, 1), 500);
  else
    return query
    select o.name
    from storage.objects o
    where o.bucket_id = 'post-media'
      and o.created_at < now() - p_older_than
      and not exists (
        select 1
        from public.post_media pm
        where pm.storage_path = o.name
          and pm.storage_bucket = 'post-media'
      )
    order by o.created_at
    limit least(greatest(p_limit, 1), 500);
  end if;
end;
$$;

revoke all on function public.purge_orphan_post_drafts(interval) from public, anon, authenticated;
grant execute on function public.purge_orphan_post_drafts(interval) to service_role;
revoke all on function public.list_orphan_media_objects(text, interval, integer)
  from public, anon, authenticated;
grant execute on function public.list_orphan_media_objects(text, interval, integer)
  to service_role;

create or replace function public.invoke_orphan_media_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'orphan_media_worker_url';

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'orphan_media_worker_token';

  if v_url is null or v_token is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('limit', 200)
  );
end;
$$;

revoke all on function public.invoke_orphan_media_worker() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-orphan-media') then
    perform cron.unschedule('purge-orphan-media');
  end if;
  -- 19:00 UTC = 03:00 Asia/Singapore.
  perform cron.schedule(
    'purge-orphan-media',
    '0 19 * * *',
    'select public.invoke_orphan_media_worker()'
  );
end;
$$;

commit;
