-- Review edit/delete and the dish rating (H33, H35).
--
-- 1. Dish totals count each reviewer once: only their latest visible review of
--    the dish counts in dishes.review_count / rating_avg. Repeat reviews are
--    still allowed (sh, 2026-10-20) and still listed. Reviews detached from a
--    deleted account (user_id null) each count on their own.
-- 2. The dish totals trigger now runs SECURITY DEFINER (app_private). The old
--    public.update_dish_rating() updated dishes as the caller, and app users
--    have no UPDATE on dishes, so a diner's insert, edit or delete never
--    changed the totals (0 rows updated, no error). A deleted review now stops
--    counting at once. The trigger also fires when user_id or created_at
--    changes, because both decide which review is a user's latest.
-- 3. Authors edit their own review (rating, text, tags, would_recommend) and
--    delete it through the existing RLS policies. The update guard keeps every
--    rule from 20261021110000_account_deletion_review_anonymise_guard.sql and
--    also locks author_name for authors: it is set from the profile on insert.
--
-- Function bodies redefined here: app_private.dish_review_stats(text),
-- public.enforce_merchant_review_reply_update(). New:
-- app_private.sync_dish_review_stats() (trigger only). Triggers recreated:
-- reviews.trg_update_dish_rating, dishes.trg_dishes_updated_at.

create schema if not exists app_private;

-- 1. Latest review per reviewer ---------------------------------------------
create or replace function app_private.dish_review_stats(p_dish_id text)
returns table (review_count integer, rating_avg numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*)::int,
    coalesce(round(avg(latest.rating)::numeric, 2), 0)
  from (
    select distinct on (coalesce(r.user_id::text, r.id::text))
      r.rating
    from public.reviews r
    where r.dish_id = p_dish_id
      and not app_private.review_is_moderation_hidden(r.id)
    order by coalesce(r.user_id::text, r.id::text), r.created_at desc, r.id desc
  ) latest;
$$;

revoke all on function app_private.dish_review_stats(text) from public, anon, authenticated;
grant execute on function app_private.dish_review_stats(text) to authenticated, service_role;

-- 2. Totals trigger runs as definer ------------------------------------------
create or replace function app_private.sync_dish_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform app_private.refresh_dish_review_stats(old.dish_id);
  end if;

  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.dish_id is distinct from old.dish_id) then
    perform app_private.refresh_dish_review_stats(new.dish_id);
  end if;

  return null;
end;
$$;

revoke all on function app_private.sync_dish_review_stats() from public, anon, authenticated;

drop trigger if exists trg_update_dish_rating on public.reviews;
create trigger trg_update_dish_rating
  after insert or delete or update of rating, dish_id, user_id, created_at on public.reviews
  for each row
  execute function app_private.sync_dish_review_stats();

-- Rating totals are not catalogue edits: a review no longer bumps
-- dishes.updated_at ("Updated 3d ago" on the dish page). Every other column
-- change still does.
drop trigger if exists trg_dishes_updated_at on public.dishes;
create trigger trg_dishes_updated_at
  before update on public.dishes
  for each row
  when (
    (to_jsonb(new) - 'review_count' - 'rating_avg' - 'updated_at')
      is distinct from (to_jsonb(old) - 'review_count' - 'rating_avg' - 'updated_at')
  )
  execute function public.set_updated_at();

-- Recompute the reviewed dishes whose totals change under the new rule.
do $$
declare
  v_dish_id text;
begin
  for v_dish_id in
    select d.id
    from public.dishes d
    cross join lateral app_private.dish_review_stats(d.id) s
    where exists (select 1 from public.reviews r where r.dish_id = d.id)
      and (d.review_count, d.rating_avg) is distinct from (s.review_count, s.rating_avg)
  loop
    perform app_private.refresh_dish_review_stats(v_dish_id);
  end loop;
end;
$$;

-- 3. Author edits keep the guard; author_name is locked ----------------------
create or replace function public.enforce_merchant_review_reply_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- app_private.sync_review_helpful_count: a nested trigger that changes only
  -- helpful_count.
  if pg_trigger_depth() > 1
    and (to_jsonb(new) - 'helpful_count') = (to_jsonb(old) - 'helpful_count') then
    return new;
  end if;

  -- Account deletion: the worker detaches the review from its author.
  if current_user not in ('anon', 'authenticated')
    and old.user_id is not null
    and new.user_id is null then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Authors edit rating, text, tags and would_recommend only.
  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
      or new.author_name is distinct from old.author_name
      or new.created_at is distinct from old.created_at
      or new.merchant_reply_text is distinct from old.merchant_reply_text
      or new.merchant_replied_at is distinct from old.merchant_replied_at
      or new.helpful_count is distinct from old.helpful_count then
      raise exception 'review authors cannot change identity or merchant reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  if merchant_can_manage_venue(old.venue_id) then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
      or new.author_name is distinct from old.author_name
      or new.rating is distinct from old.rating
      or new.text is distinct from old.text
      or new.tags is distinct from old.tags
      or new.would_recommend is distinct from old.would_recommend
      or new.created_at is distinct from old.created_at
      or new.helpful_count is distinct from old.helpful_count then
      raise exception 'merchant review updates are limited to reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update review' using errcode = '42501';
end;
$$;
