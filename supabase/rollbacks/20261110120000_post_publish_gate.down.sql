-- Undo 20261110120000_post_publish_gate: drops publish_post (wrapper and body), the photo check
-- answers table and its writer, the review-to-entry sync trigger and the live review_id index,
-- puts submit_review back to its two-argument form and gives signed-in users back the table
-- grants on posts, post_media and user_profiles they had before.
-- expect-row-loss: app_private.request_rate_rules, app_private.photo_safety_checks
-- down-loses-data: photo_safety_checks only caches check-photo-safety answers; posts keep their media.

delete from app_private.request_rate_rules where route = 'rpc/publish_post';

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'user_profiles'
    and c.column_name <> 'pinned_post_ids';
  execute format(
    'revoke insert (%s), update (%s) on table public.user_profiles from authenticated',
    v_cols, v_cols
  );
end $$;
grant insert, update on table public.user_profiles to authenticated;
revoke update (caption, deleted_at, updated_at) on table public.posts from authenticated;
grant insert, update, delete, truncate on table public.posts to authenticated;
grant insert, update, delete, truncate on table public.post_media to authenticated;

drop trigger if exists trg_reviews_sync_portfolio_entry on public.reviews;
drop function if exists app_private.sync_review_portfolio_entry();

drop function if exists public.submit_review(jsonb, jsonb, jsonb);
create or replace function public.submit_review(p_review jsonb, p_photos jsonb default '[]'::jsonb)
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

  return jsonb_build_object('review_id', v_id, 'resumed', v_resumed, 'photos_added', v_added);
end;
$$;

revoke all on function public.submit_review(jsonb, jsonb) from public, anon;
grant execute on function public.submit_review(jsonb, jsonb) to authenticated, service_role;

drop index if exists public.posts_review_id_live_key;
drop function if exists public.publish_post(jsonb, jsonb);
drop function if exists app_private.publish_post_core(jsonb, jsonb, uuid);
drop function if exists public.record_photo_safety_checks(uuid, text, jsonb);
drop table if exists app_private.photo_safety_checks;

notify pgrst, 'reload schema';
