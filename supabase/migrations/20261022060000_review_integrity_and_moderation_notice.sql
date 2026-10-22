-- Review integrity and author moderation notice (round-two G6 mediums and lows).
--
-- 1. reviews-posting-L3: the own-stall check covered the account owner and the
--    owner/manager roles only. Any member of the stall's merchant account
--    (merchant_roles of any role, or an active organisation member) is now
--    refused. Redefines app_private.reviews_before_insert_integrity(), based on
--    its only definition in 20261020030000_review_feed_index_and_integrity.sql.
-- 2. reviews-posting-L5: tags are validated when a review is inserted or its tags
--    change: only tags from the app's list, at most 8. A trigger (not a CHECK) so
--    older rows with other tags can still receive helpful-count or reply updates.
--    Keep the list in step with ALLOWED_REVIEW_TAGS in src/constants/taste.ts.
-- 3. reviews-posting-L2: reviews.edited_at is set by the server when the author
--    changes the rating, text, tags or recommendation, so readers can see "edited".
--    The author cannot write it directly.
-- 4. reviews-posting-M3: an author can ask whether their own reviews were hidden or
--    removed after reports. review_moderation_states stays closed to clients; the
--    definer function returns only the caller's own reviews in those two states.
--
-- Not changed: enforce_merchant_review_reply_update already locks author_name
-- (20261021161000) and keeps the account-deletion branch; this file does not touch it.

begin;

create schema if not exists app_private;

-- 1. Own-stall check ---------------------------------------------------------
create or replace function app_private.reviews_before_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dish_venue_id text;
  v_display_name text;
begin
  select d.venue_id
    into v_dish_venue_id
  from public.dishes d
  where d.id = new.dish_id;

  if v_dish_venue_id is not null then
    new.venue_id := v_dish_venue_id;
  end if;

  if new.user_id is not null then
    select nullif(btrim(up.display_name), '')
      into v_display_name
    from public.user_profiles up
    where up.id = new.user_id;

    new.author_name := coalesce(v_display_name, nullif(btrim(new.author_name), ''), 'Hungry User');

    if new.venue_id is not null and exists (
      select 1
      from public.merchant_outlets mo
      left join public.merchant_accounts ma
        on ma.id = mo.merchant_account_id
      where mo.venue_id = new.venue_id
        and (
          ma.user_id = new.user_id
          -- Any role on the merchant account (owner, manager, staff, ops, accountant, viewer).
          or exists (
            select 1
            from public.merchant_roles mr
            where mr.merchant_account_id = mo.merchant_account_id
              and mr.user_id = new.user_id
          )
          -- Active members of an organisation that runs the outlet.
          or exists (
            select 1
            from public.merchant_organization_outlets moo
            join public.merchant_members mm
              on mm.organization_id = moo.organization_id
            where moo.outlet_id = mo.id
              and mm.user_id = new.user_id
              and mm.status = 'active'
          )
        )
    ) then
      raise exception 'You cannot review a stall you manage.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.reviews_before_insert_integrity() from public;
revoke all on function app_private.reviews_before_insert_integrity() from anon, authenticated;

-- 2. Tag validation ----------------------------------------------------------
create or replace function app_private.reviews_validate_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_allowed constant text[] := array[
    'Spicy', 'Sweet', 'Sour', 'Savoury', 'Rich', 'Light', 'Fragrant', 'Crispy', 'Soft',
    'Wok Hei', 'Lemak', 'QQ', 'Jelak', 'Hiam', 'Gao', 'Chao Ta', 'Shiok', 'Sedap',
    'Worth the queue', 'Good value'
  ];
begin
  -- Service-role writes (imports, ops) are trusted.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.tags is not distinct from old.tags then
    return new;
  end if;

  if new.tags is null then
    new.tags := '{}';
  end if;
  if coalesce(cardinality(new.tags), 0) > 8 then
    raise exception 'A review can have at most 8 tags.'
      using errcode = '23514', hint = 'review_tags_too_many';
  end if;
  if exists (select 1 from unnest(new.tags) as t(tag) where t.tag is null or not (t.tag = any (v_allowed))) then
    raise exception 'One of the tags on this review is not allowed.'
      using errcode = '23514', hint = 'review_tags_not_allowed';
  end if;

  return new;
end;
$$;

revoke all on function app_private.reviews_validate_tags() from public, anon, authenticated;

drop trigger if exists trg_reviews_validate_tags on public.reviews;
create trigger trg_reviews_validate_tags
  before insert or update of tags on public.reviews
  for each row
  execute function app_private.reviews_validate_tags();

-- 3. Edited marker -----------------------------------------------------------
alter table public.reviews add column if not exists edited_at timestamptz;

create or replace function app_private.reviews_set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only the author's own change to the review content counts as an edit; the client
  -- value for edited_at is always ignored.
  if auth.uid() is not null
    and old.user_id = auth.uid()
    and (
      new.rating is distinct from old.rating
      or new.text is distinct from old.text
      or new.tags is distinct from old.tags
      or new.would_recommend is distinct from old.would_recommend
    ) then
    new.edited_at := now();
  elsif auth.uid() is not null then
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

revoke all on function app_private.reviews_set_edited_at() from public, anon, authenticated;

drop trigger if exists trg_reviews_set_edited_at on public.reviews;
create trigger trg_reviews_set_edited_at
  before update on public.reviews
  for each row
  execute function app_private.reviews_set_edited_at();

-- 4. Author moderation notice ------------------------------------------------
create or replace function app_private.get_my_review_moderation_states(p_review_ids uuid[])
returns table (review_id uuid, state text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rms.review_id, rms.state
  from public.review_moderation_states rms
  join public.reviews r on r.id = rms.review_id
  where r.user_id = auth.uid()
    and auth.uid() is not null
    and rms.review_id = any (p_review_ids)
    and rms.state in ('hidden', 'removed');
$$;

revoke all on function app_private.get_my_review_moderation_states(uuid[])
  from public, anon, authenticated;
grant execute on function app_private.get_my_review_moderation_states(uuid[])
  to authenticated, service_role;

create or replace function public.get_my_review_moderation_states(p_review_ids uuid[])
returns table (review_id uuid, state text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_my_review_moderation_states(p_review_ids);
$$;

revoke all on function public.get_my_review_moderation_states(uuid[]) from public, anon;
grant execute on function public.get_my_review_moderation_states(uuid[])
  to authenticated, service_role;

commit;
