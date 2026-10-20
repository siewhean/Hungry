-- Review feed index and review write integrity.
--
-- 1. The global "recent reviews" feed orders every review by
--    (created_at desc, id desc) with no dish filter. The only created_at index
--    was (dish_id, created_at, id), so the feed scanned and sorted the table.
--    The app now pages with a (created_at, id) keyset cursor, which this index
--    serves directly.
-- 2. Ratings start at 1 star. The original check allowed 0, which the editor
--    never sends. NOT VALID keeps existing rows untouched while every new
--    insert or update is checked.
-- 3. A trigger owns the derived columns on insert:
--      - venue_id always matches the reviewed dish's venue;
--      - author_name comes from the author's profile, not the client;
--    and it refuses a review of a stall the author manages (owner or manager),
--    so merchants cannot rate their own stall.
--
-- The trigger function lives in app_private (SECURITY DEFINER, empty
-- search_path) so it can read merchant roles and profiles whatever RLS allows
-- the author to see. It is a trigger function, so nothing can call it as an RPC.

create index if not exists idx_reviews_created_at_id
  on public.reviews (created_at desc, id desc);

alter table public.reviews
  drop constraint if exists reviews_rating_min_check;

alter table public.reviews
  add constraint reviews_rating_min_check
  check (rating >= 1) not valid;

create schema if not exists app_private;

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
      left join public.merchant_roles mr
        on mr.merchant_account_id = mo.merchant_account_id
      where mo.venue_id = new.venue_id
        and (
          ma.user_id = new.user_id
          or (mr.user_id = new.user_id and mr.role in ('owner', 'manager'))
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

drop trigger if exists trg_reviews_before_insert_integrity on public.reviews;
create trigger trg_reviews_before_insert_integrity
  before insert on public.reviews
  for each row
  execute function app_private.reviews_before_insert_integrity();
