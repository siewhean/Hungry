-- smoke: supabase/smoke/security_audit_fixes.sql
-- smoke: supabase/smoke/post_publish_gate.sql
-- smoke: supabase/smoke/reviews_server_side.sql
-- Fixes from the 10 Nov 2026 full-app security audit (N2, N3, N4, N7, N10, N11, L1, A8).
--
-- 1. Photo check answers are tied to the stored file. record_photo_safety_checks keeps the
--    storage object's id and its last change time, only for files that existed before the check
--    started (p_started_at). app_private.photo_check_verdict says 'clear' only for that same,
--    unchanged object, a JPEG, PNG or WebP of at most 8 MB (what Google Vision reads); 'unchecked'
--    is no longer publishable (owner decision 11 Nov: when the check is down, posting waits).
-- 2. publish_post uses the verdict and stores no client public_url (post-media is private and is
--    shown by signed URL).
-- 3. Review photos go through the same gate: a trigger on review_photos checks the photo and its
--    thumbnail and sets url and bucket itself, for submit_review and direct inserts alike.
-- 4. Files in post-media and review-media cannot be overwritten (the UPDATE policies go), and a
--    file a post or review uses cannot be deleted by its author (the orphan purge removes files
--    once nothing uses them). Merchant image buckets keep their update and delete rules.
-- 5. A review photo is no longer readable once its review is hidden or removed by moderation.
-- 6. posts: a deleted post cannot be brought back from the phone, and a post's dish must exist
--    and belong to its stall.
-- 7. award_food_cred pays a signed-in caller only for actions it can prove (a saved stall, a stall
--    it submitted, a tried stall it reviewed, a completed mission), once per stall or submission.
--    increment_mission_progress counts what the caller really did this week instead of trusting
--    each call. record_passport_progress checks the referenced row is the caller's and counts each
--    reference once.
-- 8. Housekeeping: merchant analytics counters get tighter per-IP limits (their own limit was keyed
--    on a session id the caller picks), fixed search_path on three catalog functions, no anon write
--    grants on user tables, and the unused legacy orders table is read-only.
-- 9. Batch audit items: activity events can only be marked read; conversations are written only by
--    the chat functions (a participant could rewrite created_by_user_id and then add anyone); the
--    hidden posts list shows nothing of a post the caller can no longer read; a review's author name
--    comes from the profile, never the client.
--
-- Rollback: supabase/rollbacks/20261111130000_security_audit_fixes.down.sql.

create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 and position(p_replace in v_src) > 0 then
    return;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

-- 1. Answers tied to the stored file.
alter table app_private.photo_safety_checks
  add column if not exists object_id uuid,
  add column if not exists object_updated_at timestamptz;

drop function if exists public.record_photo_safety_checks(uuid, text, jsonb);

create or replace function public.record_photo_safety_checks(
  p_user_id uuid,
  p_bucket text,
  p_checks jsonb,
  p_started_at timestamptz default null
)
returns integer
language plpgsql
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
  -- Only files that were already stored, unchanged, when the check started: an answer can never
  -- describe a file uploaded or replaced while the photos were being looked at.
  insert into app_private.photo_safety_checks (
    storage_bucket, storage_path, user_id, status, object_id, object_updated_at
  )
  select distinct on (c ->> 'path')
         p_bucket, c ->> 'path', p_user_id, c ->> 'status',
         o.id, coalesce(o.updated_at, o.created_at)
  from jsonb_array_elements(p_checks) c
  join storage.objects o on o.bucket_id = p_bucket and o.name = c ->> 'path'
  where coalesce(c ->> 'path', '') like p_user_id::text || '/%'
    and c ->> 'status' in ('clear', 'unchecked', 'blocked')
    and coalesce(o.updated_at, o.created_at) <= coalesce(p_started_at, now())
  on conflict (storage_bucket, storage_path) do update
    set status = case
          when app_private.photo_safety_checks.status = 'blocked' then 'blocked'
          else excluded.status
        end,
        object_id = excluded.object_id,
        object_updated_at = excluded.object_updated_at,
        checked_at = now()
    where app_private.photo_safety_checks.user_id = excluded.user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.record_photo_safety_checks(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.record_photo_safety_checks(uuid, text, jsonb, timestamptz) to service_role;

-- 'clear', 'blocked' or 'unchecked' for one stored photo of p_user.
create or replace function app_private.photo_check_verdict(p_bucket text, p_path text, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when c.status = 'blocked' then 'blocked'
    when c.status = 'clear'
     and o.id is not null
     and o.id = c.object_id
     and coalesce(o.updated_at, o.created_at) <= c.object_updated_at
     and coalesce(o.metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
     and coalesce(nullif(o.metadata ->> 'size', '')::bigint, 0) <= 8388608
      then 'clear'
    else 'unchecked'
  end
  from (select 1) one
  left join app_private.photo_safety_checks c
    on c.storage_bucket = p_bucket and c.storage_path = p_path and c.user_id = p_user
  left join storage.objects o
    on o.bucket_id = p_bucket and o.name = p_path;
$$;

revoke all on function app_private.photo_check_verdict(text, text, uuid) from public, anon, authenticated;

-- 2. publish_post: the verdict, and no client URL.
select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  select count(*) filter (where c.status = 'blocked'),
         count(*) filter (where c.status is null)
    into v_blocked, v_unchecked
  from jsonb_array_elements(v_media) m
  left join app_private.photo_safety_checks c
    on c.storage_bucket = 'post-media'
   and c.storage_path = m ->> 'storage_path'
   and c.user_id = v_user
  where m ->> 'media_type' = 'image';$find$,
  $repl$  -- A clear answer about this very file, unchanged since (20261111130000).
  select count(*) filter (where s.verdict = 'blocked'),
         count(*) filter (where s.verdict not in ('blocked', 'clear'))
    into v_blocked, v_unchecked
  from (
    select app_private.photo_check_verdict('post-media', m ->> 'storage_path', v_user) as verdict
    from jsonb_array_elements(v_media) m
    where m ->> 'media_type' = 'image'
  ) s;$repl$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$         nullif(m.value ->> 'public_url', ''),$find$,
  $repl$         null::text, -- never the client's URL: post-media is private, read by signed URL$repl$
);

-- 3. Review photos.
create or replace function app_private.review_photos_require_photo_check()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_verdict text;
  v_thumb_verdict text := 'clear';
begin
  -- Seeds, migrations and the service role write as themselves; only a signed-in diner is checked.
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  select r.user_id into v_owner from reviews r where r.id = new.review_id;
  new.storage_bucket := 'review-media';
  new.url := new.storage_path;
  v_verdict := app_private.photo_check_verdict('review-media', new.storage_path, v_owner);
  if new.thumb_path is not null then
    v_thumb_verdict := app_private.photo_check_verdict('review-media', new.thumb_path, v_owner);
  end if;
  if v_verdict = 'blocked' or v_thumb_verdict = 'blocked' then
    raise exception 'One of your photos can''t be posted.' using errcode = '23514', hint = 'photo_blocked';
  end if;
  if v_verdict <> 'clear' or v_thumb_verdict <> 'clear' then
    raise exception 'We could not check your photo yet. Try again.' using errcode = '23514', hint = 'photo_unchecked';
  end if;
  return new;
end;
$$;

revoke all on function app_private.review_photos_require_photo_check() from public, anon, authenticated;

drop trigger if exists trg_review_photos_require_photo_check on public.review_photos;
create trigger trg_review_photos_require_photo_check
before insert or update of storage_bucket, storage_path, thumb_path, url on public.review_photos
for each row execute function app_private.review_photos_require_photo_check();

-- 4. No overwriting, and no deleting a file that is in use.
drop policy if exists "integration_media_update_authenticated_own_prefix" on storage.objects;
create policy "integration_media_update_authenticated_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = any (array['merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = any (array['merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "review_media_update_authenticated_own_prefix" on storage.objects;

create or replace function app_private.storage_object_in_use(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_bucket
    when 'post-media' then exists (
      select 1 from public.post_media pm
      where pm.storage_bucket = 'post-media' and pm.storage_path = p_name
    )
    when 'review-media' then exists (
      select 1 from public.review_photos rp
      where rp.storage_path = p_name or rp.thumb_path = p_name
    )
    else false
  end;
$$;

revoke all on function app_private.storage_object_in_use(text, text) from public, anon;
grant execute on function app_private.storage_object_in_use(text, text) to authenticated, service_role;

drop policy if exists "integration_media_delete_authenticated_own_prefix" on storage.objects;
create policy "integration_media_delete_authenticated_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = any (array['post-media', 'merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
  and not app_private.storage_object_in_use(bucket_id, name)
);

drop policy if exists "review_media_delete_authenticated_own_prefix" on storage.objects;
create policy "review_media_delete_authenticated_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'review-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not app_private.storage_object_in_use(bucket_id, name)
);

-- 5. A moderated review's photos stop being readable.
drop policy if exists "review_media_select_signed_public_reviews" on storage.objects;
create policy "review_media_select_signed_public_reviews"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'review-media'
  and exists (
    select 1
    from public.review_photos rp
    where rp.storage_bucket = 'review-media'
      and rp.storage_path = objects.name
      and not exists (
        select 1 from public.review_moderation_states rms
        where rms.review_id = rp.review_id and rms.state in ('hidden', 'removed')
      )
  )
);

-- 6. posts: no un-delete from the phone; the dish belongs to the stall.
create or replace function app_private.posts_guard_client_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_dish_venue text;
  v_dish_found boolean;
begin
  if tg_op = 'UPDATE'
     and old.deleted_at is not null
     and new.deleted_at is null
     and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'A deleted post cannot be brought back. Post it again.' using errcode = '42501';
  end if;
  if new.dish_id is not null
     and (tg_op = 'INSERT' or new.dish_id is distinct from old.dish_id or new.venue_id is distinct from old.venue_id) then
    select d.venue_id, true into v_dish_venue, v_dish_found from dishes d where d.id = new.dish_id;
    if not coalesce(v_dish_found, false) then
      raise exception 'That dish is not in Hungry.' using errcode = '23503';
    end if;
    if new.venue_id is not null and v_dish_venue is not null and new.venue_id <> v_dish_venue then
      raise exception 'That dish is not from this stall.' using errcode = '22023';
    end if;
    new.venue_id := coalesce(new.venue_id, v_dish_venue);
  end if;
  return new;
end;
$$;

revoke all on function app_private.posts_guard_client_fields() from public, anon, authenticated;

drop trigger if exists trg_posts_guard_client_fields on public.posts;
create trigger trg_posts_guard_client_fields
before insert or update of deleted_at, dish_id, venue_id on public.posts
for each row execute function app_private.posts_guard_client_fields();

-- 7a. award_food_cred: a signed-in caller is paid only for what it can prove.
select pg_temp.patch_function(
  'app_private.award_food_cred(text, text, text, integer)'::regprocedure,
  $find$  resolved_points := coalesce(resolved_points, 0);
  cap := $find$,
  $repl$  -- gate:client-awards (20261111130000) the phone can only claim these four, each proven, and
  -- a saved or submitted stall pays once ever.
  if coalesce(auth.role(), '') <> 'service_role' then
    if normalized_action not in ('stall_saved', 'stall_marked_tried', 'stall_submitted', 'mission_completed') then
      resolved_points := 0;
    elsif normalized_action in ('stall_saved', 'stall_submitted') and (
      normalized_entity_id is null
      or exists (
        select 1 from food_cred_events fce
        where fce.user_id = current_user_id
          and fce.source_action = normalized_action
          and fce.related_entity_id = normalized_entity_id
          and fce.points > 0
      )
      or (normalized_action = 'stall_saved' and not exists (
        select 1 from user_stall_interactions usi
        where usi.user_id = current_user_id and usi.stall_id = normalized_entity_id and usi.is_saved
      ))
      or (normalized_action = 'stall_submitted' and not exists (
        select 1 from user_stall_submissions uss
        where uss.user_id = current_user_id and uss.id::text = normalized_entity_id
      ))
    ) then
      resolved_points := 0;
    end if;
  end if;

  resolved_points := coalesce(resolved_points, 0);
  cap := $repl$
);

-- 7b. Mission progress is what the caller did this week, not a count of calls.
create or replace function app_private.increment_mission_progress(p_mission_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  mission_row weekly_missions%rowtype;
  v_done integer;
  next_count integer;
  previous_completed_at timestamptz;
  next_completed_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required to update mission progress.' using errcode = '42501';
  end if;

  -- race:mission-progress (completion is detected from a prior read)
  perform pg_advisory_xact_lock(hashtextextended('food_cred:' || current_user_id::text, 0));
  for mission_row in
    select *
    from weekly_missions wm
    where wm.is_active
      and wm.mission_type = p_mission_type
      and current_date between wm.week_start and wm.week_end
  loop
    -- n-plus-one-ok: one count per active mission of this type (one a week).
    v_done := case mission_row.mission_type
      when 'save_stalls' then (
        select count(*) from user_stall_interactions usi
        where usi.user_id = current_user_id and usi.is_saved
          and (usi.saved_at at time zone 'Asia/Singapore')::date between mission_row.week_start and mission_row.week_end
      )
      when 'mark_tried' then (
        select count(*) from user_stall_interactions usi
        where usi.user_id = current_user_id and usi.is_tried
          and (usi.tried_at at time zone 'Asia/Singapore')::date between mission_row.week_start and mission_row.week_end
      )
      when 'add_stall' then (
        select count(*) from user_stall_submissions uss
        where uss.user_id = current_user_id
          and (uss.created_at at time zone 'Asia/Singapore')::date between mission_row.week_start and mission_row.week_end
      )
      when 'write_review' then (
        select count(*) from reviews r
        where r.user_id = current_user_id
          and (r.created_at at time zone 'Asia/Singapore')::date between mission_row.week_start and mission_row.week_end
      )
      when 'create_post' then (
        select count(*) from posts p
        where p.author_id = current_user_id and p.status = 'published' and p.deleted_at is null
          and (p.published_at at time zone 'Asia/Singapore')::date between mission_row.week_start and mission_row.week_end
      )
      else 0
    end;
    if coalesce(v_done, 0) <= 0 then
      continue;
    end if;

    previous_completed_at := null;
    select ump.completed_at
    into previous_completed_at
    from user_mission_progress ump
    where ump.user_id = current_user_id
      and ump.mission_id = mission_row.id;

    insert into user_mission_progress (user_id, mission_id, current_count, completed_at, updated_at)
    values (
      current_user_id,
      mission_row.id,
      least(v_done, mission_row.requirement_count),
      case when v_done >= mission_row.requirement_count then now() else null end,
      now()
    )
    on conflict (user_id, mission_id) do update
    set
      current_count = least(
        greatest(user_mission_progress.current_count, excluded.current_count),
        mission_row.requirement_count
      ),
      completed_at = coalesce(user_mission_progress.completed_at, excluded.completed_at),
      updated_at = now()
    returning current_count, completed_at into next_count, next_completed_at;

    if previous_completed_at is null
      and next_completed_at is not null
      and next_count >= mission_row.requirement_count then
      perform public.award_food_cred(
        'mission_completed',
        mission_row.id,
        'mission',
        case when mission_row.reward_type = 'food_cred' then mission_row.reward_value else 0 end
      );
    end if;
  end loop;
end;
$$;

-- 7c. Passport progress: the caller's own row, counted once.
create unique index if not exists passport_progress_events_once
  on public.passport_progress_events (user_id, category_id, event_type, reference_id);

create or replace function app_private.record_passport_progress(
  p_category_id text,
  p_event_type text,
  p_reference_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if v_ref is null
     or p_event_type not in ('stall_submitted', 'portfolio_item_added', 'public_portfolio_published', 'trail_completed') then
    raise exception 'Unknown passport event.' using errcode = '22023';
  end if;

  if not (case p_event_type
    when 'stall_submitted' then exists (
      select 1 from user_stall_submissions uss where uss.id::text = v_ref and uss.user_id = v_user
    )
    when 'portfolio_item_added' then exists (
      select 1 from portfolio_items pi
      join portfolios p on p.id = pi.portfolio_id
      where pi.id::text = v_ref
        and (p.owner_id = v_user or exists (
          select 1 from portfolio_collaborators pc where pc.portfolio_id = p.id and pc.user_id = v_user
        ))
    )
    when 'public_portfolio_published' then exists (
      select 1 from portfolios p where p.id::text = v_ref and p.owner_id = v_user and p.published_at is not null
    )
    when 'trail_completed' then exists (
      select 1 from portfolios p
      where p.id::text = v_ref and p.owner_id = v_user and p.type = 'trail' and p.published_at is not null
    )
    else false
  end) then
    return;
  end if;

  insert into public.passport_stamps (user_id, category_id)
  values (v_user, p_category_id)
  on conflict (user_id, category_id) do nothing;

  insert into public.passport_progress_events (user_id, category_id, event_type, reference_id)
  values (v_user, p_category_id, p_event_type, v_ref)
  on conflict (user_id, category_id, event_type, reference_id) do nothing
  returning id into v_event;
  if v_event is null then
    return;
  end if;

  if p_event_type = 'stall_submitted' then
    update public.passport_stamps
    set stalls_submitted_count = stalls_submitted_count + 1, updated_at = now()
    where user_id = v_user and category_id = p_category_id;
  elsif p_event_type = 'portfolio_item_added' then
    update public.passport_stamps
    set portfolio_items_added = portfolio_items_added + 1, updated_at = now()
    where user_id = v_user and category_id = p_category_id;
  elsif p_event_type = 'public_portfolio_published' then
    update public.passport_stamps
    set public_portfolios_published = public_portfolios_published + 1, updated_at = now()
    where user_id = v_user and category_id = p_category_id;
  elsif p_event_type = 'trail_completed' then
    update public.passport_stamps
    set trails_completed = trails_completed + 1, updated_at = now()
    where user_id = v_user and category_id = p_category_id;
  end if;
end;
$$;

-- 8. Housekeeping.
-- Merchant analytics: an anonymous caller picks its own session id, so the per-session limit
-- inside the functions does not hold; this per-IP limit does.
update app_private.request_rate_rules
set anon_per_minute = 20, user_per_minute = 60,
    note = 'merchant analytics counter (per IP: the session id is the caller''s own)'
where route in ('rpc/record_merchant_dish_view', 'rpc/record_merchant_action_event');

alter function app_private.catalog_quality_score(numeric, integer) set search_path = pg_catalog, pg_temp;
alter function app_private.catalog_dish_cards_set_quality() set search_path = pg_catalog, pg_temp;
alter function app_private.catalog_venue_cards_set_quality() set search_path = pg_catalog, pg_temp;

-- Row security already refuses these; the grants go too.
revoke insert, update, delete, truncate on table
  public.posts, public.post_media, public.user_profiles, public.reviews, public.review_photos,
  public.orders, public.messages
from anon;
revoke truncate on table public.messages from authenticated;

-- The legacy orders table is not used by the app (0 rows): read-only for its owner.
revoke insert, update, delete, truncate on table public.orders from authenticated;

-- 9. Batch audit items.
-- Activity events: the phone only marks them read (mark_activity_read / mark_all_activity_read).
revoke insert, update on table public.activity_events from authenticated;
grant update (read_at) on table public.activity_events to authenticated;

-- Conversations are opened and written only by the chat functions (security definer).
revoke insert, update on table public.conversations from authenticated;
revoke insert on table public.conversation_participants from authenticated;

-- Hidden posts: no caption or author of a post the caller can no longer read.
select pg_temp.patch_function(
  'app_private.list_my_hidden_posts()'::regprocedure,
  $find$left join public.posts p on p.id = hp.post_id$find$,
  $repl$left join public.posts p on p.id = hp.post_id and app_private.can_read_post(hp.post_id)$repl$
);

-- A review's author name is the profile's, never the client's.
select pg_temp.patch_function(
  'app_private.reviews_before_insert_integrity()'::regprocedure,
  $find$new.author_name := coalesce(v_display_name, nullif(btrim(new.author_name), ''), 'Hungry User');$find$,
  $repl$new.author_name := coalesce(v_display_name, 'Hungry User');$repl$
);
