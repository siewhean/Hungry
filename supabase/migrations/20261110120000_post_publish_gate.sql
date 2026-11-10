-- smoke: supabase/smoke/post_publish_gate.sql
-- Food Portfolio Phase 1 (audit 2026-11-10, P0-1, P1-2, P1-3): posts publish through the server.
--
-- 1. app_private.photo_safety_checks: check-photo-safety records its answer for each photo it
--    looked at (clear, unchecked when Vision has no key or is down, blocked). Only the service
--    role writes it, through public.record_photo_safety_checks. A blocked answer never turns back.
-- 2. publish_post(p_post, p_media): the only way a post goes live. One transaction, serialised on
--    the post id (a double tap or a retry is one post). It refuses a post with no media, a file
--    outside the caller's folder for that post, a file that is not in storage, a file whose stored
--    type does not match its media type, and any photo without a clear or unchecked answer from
--    the photo check. Draft, media rows and the switch to published happen together, so the board
--    trigger still sees the media when it pays points. The body is app_private.publish_post_core
--    (SECURITY DEFINER, the caller's id from auth.uid()); public.publish_post is the invoker wrapper.
-- 3. submit_review(p_review, p_photos, p_portfolio): with p_portfolio the review and its portfolio
--    entry are one transaction. The entry carries posts.review_id, its dish and stall come from the
--    review, and a place in the ranking (p_portfolio.rank) is set in the same transaction. A retry
--    finds the linked entry instead of making a second one. Without p_portfolio it is unchanged.
--    posts.review_id is unique among live posts.
-- 4. Editing a review's stars or words updates its linked entry (trigger on reviews).
-- 5. Signed-in users lose INSERT, UPDATE, DELETE and TRUNCATE on posts and post_media; they keep
--    UPDATE of posts.caption, deleted_at and updated_at (edit caption, soft delete). Counters,
--    status, published_at, board points and visibility move only through server functions and
--    triggers. user_profiles.pinned_post_ids is no longer writable from the phone (the ranking RPCs
--    are SECURITY DEFINER). The user_profiles column grant is built from the live column list, so a
--    column added later needs its own grant.
-- 6. Rate rules for publish_post; record_photo_safety_checks is service-role only.
-- Older app builds that write posts tables directly can no longer post: deploy check-photo-safety
-- and ship this before the app build that calls publish_post.
-- Rollback: supabase/rollbacks/20261110120000_post_publish_gate.down.sql.

create schema if not exists app_private;

-- 1. Photo check answers ----------------------------------------------------------------------
create table if not exists app_private.photo_safety_checks (
  storage_bucket text not null,
  storage_path text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('clear', 'unchecked', 'blocked')),
  checked_at timestamptz not null default now(),
  primary key (storage_bucket, storage_path)
);
alter table app_private.photo_safety_checks enable row level security;
revoke all on table app_private.photo_safety_checks from public, anon, authenticated;
grant select, insert, update, delete on table app_private.photo_safety_checks to service_role;

create or replace function public.record_photo_safety_checks(
  p_user_id uuid,
  p_bucket text,
  p_checks jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_bucket not in ('post-media', 'review-media') then
    raise exception 'A user and a known bucket are required.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_checks, 'null'::jsonb)) is distinct from 'array' then
    raise exception 'Checks must be a list.' using errcode = '22023';
  end if;
  insert into app_private.photo_safety_checks (storage_bucket, storage_path, user_id, status)
  select distinct on (c ->> 'path') p_bucket, c ->> 'path', p_user_id, c ->> 'status'
  from jsonb_array_elements(p_checks) c
  where coalesce(c ->> 'path', '') like p_user_id::text || '/%'
    and c ->> 'status' in ('clear', 'unchecked', 'blocked')
  on conflict (storage_bucket, storage_path) do update
    set status = case
          when app_private.photo_safety_checks.status = 'blocked' then 'blocked'
          else excluded.status
        end,
        checked_at = now()
    where app_private.photo_safety_checks.user_id = excluded.user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.record_photo_safety_checks(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_photo_safety_checks(uuid, text, jsonb) to service_role;

-- 2. publish_post -------------------------------------------------------------------------------
create or replace function app_private.publish_post_core(
  p_post jsonb,
  p_media jsonb,
  p_review_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_media jsonb := coalesce(p_media, '[]'::jsonb);
  v_count integer;
  v_id uuid;
  v_author uuid;
  v_status text;
  v_deleted_at timestamptz;
  v_existing boolean := false;
  v_linked uuid;
  v_bad integer;
  v_missing integer;
  v_blocked integer;
  v_unchecked integer;
  v_post_type text;
  v_caption text := left(btrim(coalesce(p_post ->> 'caption', '')), 280);
  v_content jsonb := coalesce(p_post -> 'generated_content', '{}'::jsonb);
begin
  if v_user is null then
    raise exception 'You must be signed in to publish a post.' using errcode = '28000';
  end if;
  if p_post is null or jsonb_typeof(p_post) is distinct from 'object' then
    raise exception 'A post is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_media) is distinct from 'array' then
    raise exception 'Media must be a list.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(v_media);
  if v_count = 0 then
    raise exception 'Add a photo to post.' using errcode = '23514';
  end if;
  if v_count > 10 then
    raise exception 'A post can have up to 10 photos or videos.' using errcode = '23514';
  end if;
  if jsonb_typeof(v_content) is distinct from 'object' or pg_column_size(v_content) > 16384 then
    raise exception 'Post details are not valid.' using errcode = '22023';
  end if;

  v_id := coalesce(nullif(p_post ->> 'id', '')::uuid, gen_random_uuid());
  -- One publish of one post id at a time: a double tap and a retry end up as one post.
  perform pg_advisory_xact_lock(hashtextextended('publish_post:' || v_id::text, 0));

  if p_review_id is not null then
    -- One entry per review: two attempts with different post ids still make one entry.
    perform pg_advisory_xact_lock(hashtextextended('publish_post_review:' || p_review_id::text, 0));
    if not exists (select 1 from reviews r where r.id = p_review_id and r.user_id = v_user) then
      raise exception 'That review is not yours.' using errcode = '42501';
    end if;
    select p.id into v_linked
    from posts p
    where p.review_id = p_review_id and p.author_id = v_user and p.deleted_at is null
      and p.status = 'published'
    limit 1;
    if v_linked is not null then
      return jsonb_build_object('post_id', v_linked, 'resumed', true);
    end if;
  end if;

  select p.author_id, p.status, p.deleted_at into v_author, v_status, v_deleted_at
  from posts p where p.id = v_id;
  if found then
    if v_author is distinct from v_user then
      raise exception 'This post id is already in use.' using errcode = '42501';
    end if;
    if v_status = 'published' and v_deleted_at is null then
      -- The earlier attempt published it and only its answer was lost.
      return jsonb_build_object('post_id', v_id, 'resumed', true);
    end if;
    if v_deleted_at is not null or v_status <> 'draft' then
      raise exception 'This post was deleted. Post it again.' using errcode = '55000';
    end if;
    -- A draft left by an older build: its media rows are replaced by this attempt's.
    v_existing := true;
    delete from post_media m where m.post_id = v_id;
  end if;

  select count(*) into v_bad
  from jsonb_array_elements(v_media) m
  where coalesce(m ->> 'storage_path', '') = ''
     or (m ->> 'storage_path') not like v_user::text || '/' || v_id::text || '/%'
     or position('..' in (m ->> 'storage_path')) > 0
     or coalesce(m ->> 'media_type', '') not in ('image', 'video');
  if v_bad > 0 then
    raise exception 'A file does not belong to this post.' using errcode = '42501';
  end if;
  if (select count(distinct m ->> 'storage_path') from jsonb_array_elements(v_media) m) <> v_count then
    raise exception 'The same file is listed twice.' using errcode = '22023';
  end if;

  select count(*) filter (where o.id is null),
         count(*) filter (
           where o.id is not null and coalesce(o.metadata ->> 'mimetype', '')
             not like (m ->> 'media_type') || '/%'
         )
    into v_missing, v_bad
  from jsonb_array_elements(v_media) m
  left join storage.objects o
    on o.bucket_id = 'post-media' and o.name = m ->> 'storage_path';
  if v_missing > 0 then
    raise exception 'A photo did not finish uploading. Try again.' using errcode = '23514';
  end if;
  if v_bad > 0 then
    raise exception 'A file does not match its type.' using errcode = '22023';
  end if;

  -- Every photo needs an answer from the photo check (videos are not checked).
  select count(*) filter (where c.status = 'blocked'),
         count(*) filter (where c.status is null)
    into v_blocked, v_unchecked
  from jsonb_array_elements(v_media) m
  left join app_private.photo_safety_checks c
    on c.storage_bucket = 'post-media'
   and c.storage_path = m ->> 'storage_path'
   and c.user_id = v_user
  where m ->> 'media_type' = 'image';
  if v_blocked > 0 then
    raise exception 'One of your photos can''t be posted.' using errcode = '23514', hint = 'photo_blocked';
  end if;
  if v_unchecked > 0 then
    raise exception 'We could not check your photo yet. Try again.' using errcode = '23514', hint = 'photo_unchecked';
  end if;

  if v_existing then
    update posts
    set caption = v_caption,
        generated_content = v_content,
        dish_id = nullif(p_post ->> 'dish_id', ''),
        venue_id = nullif(p_post ->> 'venue_id', ''),
        building_id = nullif(p_post ->> 'building_id', ''),
        review_id = p_review_id
    where id = v_id;
  else
    insert into posts (
      id, author_id, post_type, status, visibility, caption, generated_content,
      dish_id, venue_id, building_id, review_id
    )
    values (
      v_id, v_user, 'text', 'draft', 'public', v_caption, v_content,
      nullif(p_post ->> 'dish_id', ''), nullif(p_post ->> 'venue_id', ''),
      nullif(p_post ->> 'building_id', ''), p_review_id
    );
  end if;

  insert into post_media (
    post_id, media_type, storage_bucket, storage_path, public_url, mime_type, size_bytes, sort_order
  )
  select v_id,
         m.value ->> 'media_type',
         'post-media',
         m.value ->> 'storage_path',
         nullif(m.value ->> 'public_url', ''),
         o.metadata ->> 'mimetype',
         nullif(o.metadata ->> 'size', '')::bigint,
         (m.ordinality - 1)::integer
  from jsonb_array_elements(v_media) with ordinality as m(value, ordinality)
  join storage.objects o on o.bucket_id = 'post-media' and o.name = m.value ->> 'storage_path';

  v_post_type := case
    when exists (select 1 from jsonb_array_elements(v_media) m where m ->> 'media_type' = 'video') then 'video'
    when v_count > 1 then 'multi_image'
    else 'image'
  end;

  -- The status change is what the board trigger pays on, now that the media rows exist.
  update posts
  set post_type = v_post_type, status = 'published', published_at = now(), updated_at = now()
  where id = v_id;

  return jsonb_build_object('post_id', v_id, 'resumed', false);
end;
$$;

revoke all on function app_private.publish_post_core(jsonb, jsonb, uuid) from public, anon;
grant execute on function app_private.publish_post_core(jsonb, jsonb, uuid) to authenticated, service_role;

create or replace function public.publish_post(p_post jsonb, p_media jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.publish_post_core(p_post, p_media, null);
$$;

revoke all on function public.publish_post(jsonb, jsonb) from public, anon;
grant execute on function public.publish_post(jsonb, jsonb) to authenticated, service_role;

create unique index if not exists posts_review_id_live_key
  on public.posts (review_id)
  where review_id is not null and deleted_at is null;

-- 3. submit_review with the portfolio entry ------------------------------------------------------
drop function if exists public.submit_review(jsonb, jsonb);

create or replace function public.submit_review(
  p_review jsonb,
  p_photos jsonb default '[]'::jsonb,
  p_portfolio jsonb default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_owner uuid;
  v_resumed boolean := false;
  v_photos jsonb := coalesce(p_photos, '[]'::jsonb);
  v_existing_photos integer;
  v_added integer := 0;
  v_bad_path integer;
  v_entry jsonb;
  v_post_id uuid;
  v_post_resumed boolean := false;
  v_dish text;
  v_venue text;
begin
  if v_user is null then
    raise exception 'You must be signed in to submit reviews.' using errcode = '28000';
  end if;
  if p_review is null or jsonb_typeof(p_review) is distinct from 'object' then
    raise exception 'A review is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_photos) is distinct from 'array' then
    raise exception 'Photos must be a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_photos) > 10 then
    raise exception 'A review can have up to 10 photos.' using errcode = '23514';
  end if;
  if p_portfolio is not null and jsonb_typeof(p_portfolio) is distinct from 'object' then
    raise exception 'The portfolio entry is not valid.' using errcode = '22023';
  end if;

  v_id := coalesce(nullif(p_review ->> 'id', '')::uuid, gen_random_uuid());

  -- Everything for one review id runs one at a time: the statement after the lock sees what an
  -- overlapping call committed, so a retry and a double tap both end up as one review.
  perform pg_advisory_xact_lock(hashtextextended('submit_review:' || v_id::text, 0));

  select r.user_id into v_owner from public.reviews r where r.id = v_id;
  if found then
    if v_owner is distinct from v_user then
      raise exception 'This review id is already in use.' using errcode = '42501';
    end if;
    v_resumed := true;
    -- Keep any edits made between attempts. The edited marker only moves if a value changed.
    update public.reviews
    set rating = (p_review ->> 'rating')::numeric,
        text = coalesce(p_review ->> 'text', ''),
        tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_review -> 'tags', '[]'::jsonb))), '{}'),
        would_recommend = coalesce((p_review ->> 'would_recommend')::boolean, true)
    where id = v_id and user_id = v_user;
  else
    insert into public.reviews (id, user_id, dish_id, venue_id, rating, text, tags, would_recommend)
    values (
      v_id,
      v_user,
      p_review ->> 'dish_id',
      nullif(p_review ->> 'venue_id', ''),
      (p_review ->> 'rating')::numeric,
      coalesce(p_review ->> 'text', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_review -> 'tags', '[]'::jsonb))), '{}'),
      coalesce((p_review ->> 'would_recommend')::boolean, true)
    );
  end if;

  select count(*) into v_existing_photos from public.review_photos rp where rp.review_id = v_id;
  if v_existing_photos = 0 then
    -- No photo, no review: raising here rolls back the review insert above too.
    if jsonb_array_length(v_photos) = 0 then
      raise exception 'Add a photo to publish your review.' using errcode = '23514';
    end if;
    select count(*) into v_bad_path
    from jsonb_array_elements(v_photos) p
    where coalesce(p ->> 'storage_path', '') = ''
       or (p ->> 'storage_path') not like v_user::text || '/%'
       or (nullif(p ->> 'thumb_path', '') is not null and (p ->> 'thumb_path') not like v_user::text || '/%');
    if v_bad_path > 0 then
      raise exception 'A photo path does not belong to you.' using errcode = '42501';
    end if;
    insert into public.review_photos (review_id, url, storage_bucket, storage_path, thumb_path, sort_order)
    select v_id,
           p.value ->> 'storage_path',
           'review-media',
           p.value ->> 'storage_path',
           nullif(p.value ->> 'thumb_path', ''),
           (p.ordinality - 1)::integer
    from jsonb_array_elements(v_photos) with ordinality as p(value, ordinality);
    get diagnostics v_added = row_count;
  end if;

  -- The portfolio entry goes in with the review or not at all: any refusal below (a blocked
  -- photo, a file that did not upload) rolls the review back too.
  if p_portfolio is not null then
    select r.dish_id, r.venue_id into v_dish, v_venue from public.reviews r where r.id = v_id;
    v_entry := app_private.publish_post_core(
      coalesce(p_portfolio -> 'post', '{}'::jsonb)
        || jsonb_build_object('dish_id', v_dish, 'venue_id', coalesce(v_venue, '')),
      p_portfolio -> 'media',
      v_id
    );
    v_post_id := (v_entry ->> 'post_id')::uuid;
    v_post_resumed := coalesce((v_entry ->> 'resumed')::boolean, false);
    if not v_post_resumed and jsonb_typeof(p_portfolio -> 'rank') = 'number' then
      perform app_private.rank_portfolio_post(v_post_id, (p_portfolio ->> 'rank')::integer);
    end if;
  end if;

  return jsonb_build_object(
    'review_id', v_id,
    'resumed', v_resumed,
    'photos_added', v_added,
    'post_id', v_post_id,
    'post_resumed', v_post_resumed
  );
end;
$$;

revoke all on function public.submit_review(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.submit_review(jsonb, jsonb, jsonb) to authenticated, service_role;

-- 4. A review edit reaches its entry -------------------------------------------------------------
create or replace function app_private.sync_review_portfolio_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.rating is not distinct from old.rating and new.text is not distinct from old.text then
    return null;
  end if;
  update posts p
  set caption = case
        when new.text is distinct from old.text and btrim(coalesce(new.text, '')) <> ''
          then left(btrim(new.text), 280)
        else p.caption
      end,
      generated_content = case
        when new.rating is distinct from old.rating and coalesce(new.rating, 0) > 0
          then jsonb_set(coalesce(p.generated_content, '{}'::jsonb), '{rating}', to_jsonb(new.rating))
        else p.generated_content
      end,
      updated_at = now()
  where p.review_id = new.id and p.author_id = new.user_id and p.deleted_at is null;
  return null;
end;
$$;

revoke all on function app_private.sync_review_portfolio_entry() from public, anon, authenticated;

drop trigger if exists trg_reviews_sync_portfolio_entry on public.reviews;
create trigger trg_reviews_sync_portfolio_entry
after update of rating, text on public.reviews
for each row execute function app_private.sync_review_portfolio_entry();

-- 5. Column locks -------------------------------------------------------------------------------
revoke insert, update, delete, truncate on table public.posts from authenticated;
grant update (caption, deleted_at, updated_at) on table public.posts to authenticated;
revoke insert, update, delete, truncate on table public.post_media from authenticated;

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'user_profiles'
    and c.column_name <> 'pinned_post_ids';
  execute 'revoke insert, update on table public.user_profiles from authenticated';
  execute format(
    'grant insert (%s), update (%s) on table public.user_profiles to authenticated',
    v_cols, v_cols
  );
end $$;

-- 6. Rate rules -----------------------------------------------------------------------------------
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/publish_post', null, 12, 'publish a post (server checks media and the photo check)')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
