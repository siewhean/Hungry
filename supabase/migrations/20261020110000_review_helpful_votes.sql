-- "Helpful" votes on reviews, saved on the server.
--
-- 1. public.review_helpful_votes holds one row per (review, voter). Signed-in
--    users add and remove only their own vote, only on a review they can read
--    (the reviews SELECT policies apply inside the check) and never on their
--    own review. A voter reads back only their own votes; anon gets nothing.
-- 2. public.reviews.helpful_count is the public count. It is readable wherever
--    the review is readable, so guests see counts without any new grant.
--    A trigger keeps it in sync, like posts.like_count (0026). The trigger
--    function lives in app_private (SECURITY DEFINER, empty search_path) and
--    is only reachable as a trigger.
-- 3. The review update guard lets that trigger write helpful_count (nested
--    trigger, nothing else changed) and stops authors and merchants writing it
--    directly.
-- 4. trg_update_dish_rating now fires on rating/dish_id updates only, so a
--    helpful vote does not recompute dish totals or rebuild the catalog.
--
-- There is no limit on how many reviews a user writes (sh, 2026-10-20): this
-- migration adds none, and no unique or rate-limit rule exists on reviews.

alter table public.reviews
  add column if not exists helpful_count integer not null default 0;

alter table public.reviews
  drop constraint if exists reviews_helpful_count_nonnegative;
alter table public.reviews
  add constraint reviews_helpful_count_nonnegative check (helpful_count >= 0);

create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists idx_review_helpful_votes_user
  on public.review_helpful_votes (user_id, created_at desc);

alter table public.review_helpful_votes enable row level security;

revoke all on table public.review_helpful_votes from public, anon, authenticated;
grant select, insert, delete on table public.review_helpful_votes to authenticated;
grant all on table public.review_helpful_votes to service_role;

drop policy if exists review_helpful_votes_select_own on public.review_helpful_votes;
create policy review_helpful_votes_select_own
on public.review_helpful_votes
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists review_helpful_votes_insert_own on public.review_helpful_votes;
create policy review_helpful_votes_insert_own
on public.review_helpful_votes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and r.user_id is distinct from (select auth.uid())
  )
);

drop policy if exists review_helpful_votes_delete_own on public.review_helpful_votes;
create policy review_helpful_votes_delete_own
on public.review_helpful_votes
for delete
to authenticated
using (user_id = (select auth.uid()));

create schema if not exists app_private;

create or replace function app_private.sync_review_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews r
  set helpful_count = (
    select count(*)::integer
    from public.review_helpful_votes v
    where v.review_id = v_review_id
  )
  where r.id = v_review_id;

  return coalesce(new, old);
end;
$$;

revoke all on function app_private.sync_review_helpful_count() from public;
revoke all on function app_private.sync_review_helpful_count() from anon, authenticated;

drop trigger if exists trg_review_helpful_votes_sync_count on public.review_helpful_votes;
create trigger trg_review_helpful_votes_sync_count
  after insert or delete on public.review_helpful_votes
  for each row
  execute function app_private.sync_review_helpful_count();

-- Same rules as 0021, plus the helpful_count bypass and lock.
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

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
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

drop trigger if exists trg_update_dish_rating on public.reviews;
create trigger trg_update_dish_rating
  after insert or delete or update of rating, dish_id on public.reviews
  for each row
  execute function public.update_dish_rating();
