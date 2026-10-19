-- Follow-up to 20261019041100_user_blocks_by_user_id.sql.
--
-- The restrictive reviews SELECT policy (reviews_select_hide_blocked_or_reported)
-- had two side effects:
--   1. public.update_dish_rating() runs as the caller and recomputes
--      dishes.review_count / rating_avg with count(*) and avg() over reviews.
--      When a merchant who had blocked or reported a reviewer wrote to a review
--      on their dish, the trigger rewrote the dish totals for everyone without
--      the reviews hidden from that merchant.
--   2. A restrictive SELECT policy also limits which rows UPDATE can target, so
--      a merchant could no longer reply to a review on their own venue once
--      they had blocked its author or reported it (the update matched 0 rows).
--
-- Fix:
--   1. Dish totals are read through a SECURITY DEFINER helper that sees every
--      review. The dishes UPDATE itself still runs as the caller, so who can
--      write dish rows is unchanged.
--   2. Merchant owners/managers of the review's venue are exempt from the
--      block/report review filter, so they can still read and reply to every
--      review of their own venue.

-- 1. Dish rating totals see every review.
create or replace function app_private.dish_review_stats(p_dish_id text)
returns table (review_count integer, rating_avg numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*)::int,
    coalesce(round(avg(r.rating)::numeric, 2), 0)
  from public.reviews r
  where r.dish_id = p_dish_id;
$$;

revoke all on function app_private.dish_review_stats(text) from public, anon, authenticated;
grant execute on function app_private.dish_review_stats(text) to authenticated, service_role;

create or replace function public.update_dish_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update dishes d
    set
      review_count = s.review_count,
      rating_avg = s.rating_avg
    from app_private.dish_review_stats(old.dish_id) s
    where d.id = old.dish_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update dishes d
    set
      review_count = s.review_count,
      rating_avg = s.rating_avg
    from app_private.dish_review_stats(new.dish_id) s
    where d.id = new.dish_id;

    return new;
  end if;

  return old;
end;
$$;

-- 2. Venue merchants keep read/reply access to their own venue's reviews.
create or replace function app_private.can_read_review(
  p_review_id uuid,
  p_author_id uuid,
  p_venue_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    app_private.can_read_review(p_review_id, p_author_id)
    or (
      p_venue_id is not null
      and public.merchant_can_manage_venue(p_venue_id)
    );
$$;

revoke all on function app_private.can_read_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function app_private.can_read_review(uuid, uuid, text) to authenticated, service_role;

drop policy if exists reviews_select_hide_blocked_or_reported on public.reviews;
create policy reviews_select_hide_blocked_or_reported
on public.reviews
as restrictive
for select
to authenticated
using (app_private.can_read_review(id, user_id, venue_id));
