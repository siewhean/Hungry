-- Undo 20261111130000_security_audit_fixes: puts the photo check, storage rules, post and review
-- triggers, award, mission and passport functions, rate rules and grants back as they were.
-- down-loses-data: only photo_safety_checks.object_id/object_updated_at (which file an answer was about).

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

-- 8. Housekeeping.
grant insert, update, delete, truncate on table public.orders to authenticated;
grant truncate on table public.messages to authenticated;
grant insert, update, delete, truncate on table
  public.posts, public.post_media, public.user_profiles, public.reviews, public.review_photos,
  public.orders, public.messages
to anon;

alter function app_private.catalog_quality_score(numeric, integer) reset search_path;
alter function app_private.catalog_dish_cards_set_quality() reset search_path;
alter function app_private.catalog_venue_cards_set_quality() reset search_path;

update app_private.request_rate_rules
set anon_per_minute = 120, user_per_minute = 180, note = 'merchant analytics counter'
where route in ('rpc/record_merchant_dish_view', 'rpc/record_merchant_action_event');

-- 7c. Passport progress.
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.passport_stamps (user_id, category_id)
  values (auth.uid(), p_category_id)
  on conflict (user_id, category_id) do nothing;

  insert into public.passport_progress_events (user_id, category_id, event_type, reference_id)
  values (auth.uid(), p_category_id, p_event_type, p_reference_id);

  if p_event_type = 'stall_submitted' then
    update public.passport_stamps
    set stalls_submitted_count = stalls_submitted_count + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'portfolio_item_added' then
    update public.passport_stamps
    set portfolio_items_added = portfolio_items_added + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'public_portfolio_published' then
    update public.passport_stamps
    set public_portfolios_published = public_portfolios_published + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'trail_completed' then
    update public.passport_stamps
    set trails_completed = trails_completed + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  end if;
end;
$$;

drop index if exists public.passport_progress_events_once;

-- 7b. Mission progress.
create or replace function app_private.increment_mission_progress(p_mission_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  mission_row weekly_missions%rowtype;
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
    previous_completed_at := null;

    select ump.completed_at
    into previous_completed_at
    from user_mission_progress ump
    where ump.user_id = current_user_id
      and ump.mission_id = mission_row.id;

    insert into user_mission_progress (
      user_id,
      mission_id,
      current_count,
      completed_at,
      updated_at
    )
    values (
      current_user_id,
      mission_row.id,
      1,
      case when mission_row.requirement_count <= 1 then now() else null end,
      now()
    )
    on conflict (user_id, mission_id) do update
    set
      current_count = least(
        user_mission_progress.current_count + 1,
        mission_row.requirement_count
      ),
      completed_at = case
        when user_mission_progress.completed_at is not null
          then user_mission_progress.completed_at
        when user_mission_progress.current_count + 1 >= mission_row.requirement_count
          then now()
        else null
      end,
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

-- 7a. award_food_cred.
select pg_temp.patch_function(
  'app_private.award_food_cred(text, text, text, integer)'::regprocedure,
  $find$  -- gate:client-awards (20261111130000) the phone can only claim these four, each proven, and
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
  cap := $find$,
  $repl$  resolved_points := coalesce(resolved_points, 0);
  cap := $repl$
);

-- 6. posts.
drop trigger if exists trg_posts_guard_client_fields on public.posts;
drop function if exists app_private.posts_guard_client_fields();

-- 5. Review photo reads.
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
  )
);

-- 4. Storage update and delete rules.
drop policy if exists "review_media_delete_authenticated_own_prefix" on storage.objects;
create policy "review_media_delete_authenticated_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'review-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "integration_media_delete_authenticated_own_prefix" on storage.objects;
create policy "integration_media_delete_authenticated_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = any (array['post-media', 'merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop function if exists app_private.storage_object_in_use(text, text);

drop policy if exists "review_media_update_authenticated_own_prefix" on storage.objects;
create policy "review_media_update_authenticated_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'review-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'review-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "integration_media_update_authenticated_own_prefix" on storage.objects;
create policy "integration_media_update_authenticated_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = any (array['post-media', 'merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = any (array['post-media', 'merchant-dish-images', 'merchant-stall-images'])
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Review photos.
drop trigger if exists trg_review_photos_require_photo_check on public.review_photos;
drop function if exists app_private.review_photos_require_photo_check();

-- 2. publish_post.
select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$         null::text, -- never the client's URL: post-media is private, read by signed URL$find$,
  $repl$         nullif(m.value ->> 'public_url', ''),$repl$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  -- A clear answer about this very file, unchanged since (20261111130000).
  select count(*) filter (where s.verdict = 'blocked'),
         count(*) filter (where s.verdict not in ('blocked', 'clear'))
    into v_blocked, v_unchecked
  from (
    select app_private.photo_check_verdict('post-media', m ->> 'storage_path', v_user) as verdict
    from jsonb_array_elements(v_media) m
    where m ->> 'media_type' = 'image'
  ) s;$find$,
  $repl$  select count(*) filter (where c.status = 'blocked'),
         count(*) filter (where c.status is null)
    into v_blocked, v_unchecked
  from jsonb_array_elements(v_media) m
  left join app_private.photo_safety_checks c
    on c.storage_bucket = 'post-media'
   and c.storage_path = m ->> 'storage_path'
   and c.user_id = v_user
  where m ->> 'media_type' = 'image';$repl$
);

drop function if exists app_private.photo_check_verdict(text, text, uuid);

-- 1. The photo check.
drop function if exists public.record_photo_safety_checks(uuid, text, jsonb, timestamptz);

create or replace function public.record_photo_safety_checks(p_user_id uuid, p_bucket text, p_checks jsonb)
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

alter table app_private.photo_safety_checks
  drop column if exists object_updated_at,
  drop column if exists object_id;
