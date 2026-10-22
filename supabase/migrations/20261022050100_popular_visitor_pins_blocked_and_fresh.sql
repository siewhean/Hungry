-- Popular visitor pins: hide blocked or reported authors and keep the snapshot
-- fresh (round-two low detail-L2).
--
-- 1. The reviews table hides a review from a viewer who blocked its author (or
--    was blocked by them) and from a viewer who reported it
--    (reviews_select_hide_blocked_or_reported, via app_private.can_read_review).
--    The pins table copied the review but only hid moderated reviews, so a
--    viewer could still see a pinned review by someone they blocked. A
--    restrictive select policy now applies the same rule; the outlet's own
--    managers still see every pin (they pinned it, and the merchant list needs
--    it to unpin).
-- 2. A pin is a snapshot of the review (text, rating, dish, author). When the
--    reviewer edits the review the snapshot went stale. An after-update trigger
--    on reviews now re-runs the pin's normalize trigger (which copies the
--    review again) for every pin of that review.

begin;

create schema if not exists app_private;

-- 1. Blocked / reported authors --------------------------------------------

drop policy if exists popular_visitor_pins_hide_blocked_or_reported
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_hide_blocked_or_reported
on public.merchant_popular_visitor_pins
as restrictive
for select
to authenticated
using (
  app_private.can_read_review(review_id, author_profile_id)
  or public.merchant_can_manage_outlet_v2(outlet_id)
);

-- 2. Fresh snapshot ----------------------------------------------------------

create index if not exists idx_popular_visitor_pins_review
  on public.merchant_popular_visitor_pins (review_id);

create or replace function app_private.refresh_popular_visitor_pins_for_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Naming review_id in the SET list fires trg_normalize_merchant_popular_visitor_pin,
  -- which copies text, rating, dish name, author and date from the review again.
  update public.merchant_popular_visitor_pins
  set review_id = review_id
  where review_id = new.id;
  return null;
end;
$$;

revoke all on function app_private.refresh_popular_visitor_pins_for_review() from public, anon, authenticated;

drop trigger if exists trg_reviews_refresh_popular_visitor_pins on public.reviews;
create trigger trg_reviews_refresh_popular_visitor_pins
after update of text, rating, dish_id on public.reviews
for each row
when (
  old.text is distinct from new.text
  or old.rating is distinct from new.rating
  or old.dish_id is distinct from new.dish_id
)
execute function app_private.refresh_popular_visitor_pins_for_review();

commit;
