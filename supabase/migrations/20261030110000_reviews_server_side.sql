-- smoke: supabase/smoke/reviews_server_side.sql
-- Reviews, round four (REV-7, REV-2, REV-8, REV-6, REV-4b, REV-5): the server side.
--
-- 1. submit_review(p_review, p_photos): publishing is one transaction. The review and its photo
--    rows go in together, a review with no photo is refused, and a retry with the same review id
--    resumes the same review (two overlapping calls are serialised on that id), so a photo
--    problem can no longer leave a live review without its photos. SECURITY INVOKER: the review
--    insert policies, the text filter, the own-stall check and the tag check all still apply.
-- 2. review_photos.thumb_path: a 480 px copy the app uploads next to each photo, so the grid does
--    not download the 2048 px original for a 130 pt tile. Older rows keep it null.
-- 3. get_review_feed_page(...): one call returns a page of the feed with dish, stall, author,
--    photo paths, the viewer's helpful vote and the author's own moderation notice, instead of
--    about six serial reads. search_reviews(...) is the same page filtered by text, dish name,
--    stall name or a taste tag (trigram and tag indexes), over every review, not only the loaded
--    page. Both are SECURITY INVOKER, so row-level security (moderation hiding, blocks) is
--    unchanged. The shared body is app_private.review_feed_page; the public functions are
--    VOLATILE on purpose so the per-route request limiter can count them.
-- 4. content_reports refuses a report of the reporter's own review (REV-4b): the app already hid
--    the option, now the server enforces it.
-- 5. dish_taste_ratings.review_id becomes ON DELETE CASCADE: a rating no longer outlives the
--    review it was written with (REV-5).
-- 6. Rate rules for the three new endpoints.
-- The old table-insert publish path is left in place so older app builds keep working; closing it
-- is a follow-up once those builds are gone.
-- Rollback: supabase/rollbacks/20261030110000_reviews_server_side.down.sql.

-- 2. Thumbnail path ----------------------------------------------------------------------------
alter table public.review_photos add column if not exists thumb_path text;

-- 3b. Indexes for search ----------------------------------------------------------------------
create index if not exists idx_reviews_text_trgm
  on public.reviews using gin (text gin_trgm_ops);
create index if not exists idx_reviews_tags
  on public.reviews using gin (tags);

-- 1. submit_review ----------------------------------------------------------------------------
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

-- 3. Feed page and search ---------------------------------------------------------------------
-- The body behind get_review_feed_page and search_reviews. SECURITY INVOKER and STABLE: the
-- caller's row-level security decides which reviews, dishes and photos they see.
create or replace function app_private.review_feed_page(
  p_limit integer default 50,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_after timestamptz default null,
  p_venue_id text default null,
  p_dish_ids text[] default null,
  p_with_photos boolean default false,
  p_query text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_query text := left(nullif(btrim(coalesce(p_query, '')), ''), 80);
  v_pattern text;
  -- Same list as app_private.reviews_validate_tags: the only values a review's tags can hold.
  v_allowed constant text[] := array[
    'Spicy', 'Sweet', 'Sour', 'Savoury', 'Rich', 'Light', 'Fragrant', 'Crispy', 'Soft',
    'Wok Hei', 'Lemak', 'QQ', 'Jelak', 'Hiam', 'Gao', 'Chao Ta', 'Shiok', 'Sedap',
    'Worth the queue', 'Good value'
  ];
  v_tag_hits text[] := '{}';
  v_result jsonb;
begin
  if v_query is not null then
    v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_tag_hits := coalesce(array(select t from unnest(v_allowed) t where t ilike v_pattern), '{}');
  end if;

  with page as materialized (
    select r.*
    from public.reviews r
    where (
        p_before is null
        or (p_before_id is null and r.created_at < p_before)
        or (p_before_id is not null and (r.created_at, r.id) < (p_before, p_before_id))
      )
      and (p_after is null or r.created_at >= p_after)
      and (p_venue_id is null or r.venue_id = p_venue_id)
      and (p_dish_ids is null or r.dish_id = any (p_dish_ids))
      and (not coalesce(p_with_photos, false)
           or exists (select 1 from public.review_photos rp0 where rp0.review_id = r.id))
      and (
        v_query is null
        or r.id in (
          select r1.id from public.reviews r1 where r1.text ilike v_pattern
          union
          select r2.id from public.reviews r2 join public.dishes d2 on d2.id = r2.dish_id
            where d2.name ilike v_pattern
          union
          select r3.id from public.reviews r3 join public.venues v3 on v3.id = r3.venue_id
            where v3.name ilike v_pattern
          union
          select r4.id from public.reviews r4 where r4.tags && v_tag_hits
        )
      )
    order by r.created_at desc, r.id desc
    limit v_limit
  ),
  own as (
    select o.review_id, o.state
    from public.get_my_review_moderation_states(
      (select array_agg(p.id) from page p where p.user_id = auth.uid())
    ) o
  ),
  entries as (
    select
      p.created_at,
      p.id,
      jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'dish_id', p.dish_id,
        'venue_id', coalesce(p.venue_id, d.venue_id),
        'author_name', coalesce(pp.display_name, p.author_name),
        'author_avatar_url', pp.avatar_url,
        'rating', p.rating,
        'created_at', p.created_at,
        'text', p.text,
        'tags', to_jsonb(p.tags),
        'would_recommend', p.would_recommend,
        'merchant_reply_text', p.merchant_reply_text,
        'merchant_replied_at', p.merchant_replied_at,
        'helpful_count', p.helpful_count,
        'edited_at', p.edited_at,
        'dish_name', d.name,
        'venue_name', coalesce(v.name, ''),
        'photos', coalesce(ph.photos, '[]'::jsonb),
        'viewer_found_helpful', exists (
          select 1 from public.review_helpful_votes hv
          where hv.review_id = p.id and hv.user_id = auth.uid()
        ),
        'moderation_state', o.state
      ) as j
    from page p
    -- A review of a dish the viewer cannot read is left out (it still counts in raw_count).
    join public.dishes d on d.id = p.dish_id
    left join public.venues v on v.id = coalesce(p.venue_id, d.venue_id)
    left join public.public_profiles pp on pp.id = p.user_id
    left join lateral (
      select jsonb_agg(
               jsonb_build_object(
                 'storage_bucket', rp.storage_bucket,
                 'storage_path', rp.storage_path,
                 'thumb_path', rp.thumb_path,
                 'url', rp.url
               )
               order by rp.sort_order
             ) as photos
      from public.review_photos rp
      where rp.review_id = p.id
    ) ph on true
    left join own o on o.review_id = p.id
  )
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(e.j order by e.created_at desc, e.id desc) from entries e), '[]'::jsonb),
    'raw_count', (select count(*) from page),
    'has_more', (select count(*) from page) >= v_limit,
    'next_cursor', (
      select jsonb_build_object('before', p.created_at, 'before_id', p.id)
      from page p
      order by p.created_at asc, p.id asc
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function app_private.review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean, text) from public;
grant execute on function app_private.review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean, text)
  to anon, authenticated, service_role;

create or replace function public.get_review_feed_page(
  p_limit integer default 50,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_after timestamptz default null,
  p_venue_id text default null,
  p_dish_ids text[] default null,
  p_with_photos boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.review_feed_page(
    p_limit, p_before, p_before_id, p_after, p_venue_id, p_dish_ids, p_with_photos, null
  );
$$;

revoke all on function public.get_review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean) from public;
grant execute on function public.get_review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean)
  to anon, authenticated, service_role;

create or replace function public.search_reviews(
  p_query text,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50,
  p_with_photos boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Under two letters matches nearly everything: show nothing instead.
  if char_length(btrim(coalesce(p_query, ''))) < 2 then
    return jsonb_build_object('entries', '[]'::jsonb, 'raw_count', 0, 'has_more', false, 'next_cursor', null);
  end if;
  return app_private.review_feed_page(
    p_limit, p_before, p_before_id, null, null, null, p_with_photos, p_query
  );
end;
$$;

revoke all on function public.search_reviews(text, timestamptz, uuid, integer, boolean) from public;
grant execute on function public.search_reviews(text, timestamptz, uuid, integer, boolean)
  to anon, authenticated, service_role;

-- 4. REV-4b: no reports of your own review -------------------------------------------------------
create or replace function app_private.content_reports_block_self_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'review'
    and btrim(coalesce(new.target_id, ''))
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.reviews r
      where r.id = btrim(new.target_id)::uuid
        and r.user_id = new.reporter_id
    ) then
    raise exception 'You cannot report your own review.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app_private.content_reports_block_self_report() from public, anon, authenticated;

drop trigger if exists trg_content_reports_block_self_report on public.content_reports;
create trigger trg_content_reports_block_self_report
  before insert on public.content_reports
  for each row
  execute function app_private.content_reports_block_self_report();

-- 5. REV-5: a taste rating goes with its review ------------------------------------------------
alter table public.dish_taste_ratings
  drop constraint if exists dish_taste_ratings_review_id_fkey;
alter table public.dish_taste_ratings
  add constraint dish_taste_ratings_review_id_fkey
  foreign key (review_id) references public.reviews (id) on delete cascade;

-- 6. Rate limits --------------------------------------------------------------------------------
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/submit_review', null, 20, 'publish a review, one call that replaces two table writes'),
  ('rpc/get_review_feed_page', 90, 180, 'Reviews grid pages, dish and stall review lists'),
  ('rpc/search_reviews', 30, 60, 'search all reviews by text, dish, stall or taste tag')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
