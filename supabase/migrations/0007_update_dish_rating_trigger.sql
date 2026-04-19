-- Phase 7: keep dishes.rating_avg + dishes.review_count in sync with reviews writes.
-- Mirrors the aggregate behavior described in backend-architecture.md.

create or replace function public.update_dish_rating()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = new.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = new.dish_id),
        0
      )
    where id = new.dish_id;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = old.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = old.dish_id),
        0
      )
    where id = old.dish_id;

    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = new.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = new.dish_id),
        0
      )
    where id = new.dish_id;

    return new;
  end if;

  update dishes
  set
    review_count = (select count(*)::int from reviews where dish_id = old.dish_id),
    rating_avg = coalesce(
      (select round(avg(rating)::numeric, 2) from reviews where dish_id = old.dish_id),
      0
    )
  where id = old.dish_id;

  return old;
end;
$$;

drop trigger if exists trg_update_dish_rating on reviews;
create trigger trg_update_dish_rating
after insert or update or delete on reviews
for each row
execute function public.update_dish_rating();

-- One-time backfill for existing seeded rows.
update dishes
set
  review_count = (select count(*)::int from reviews where dish_id = dishes.id),
  rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews where dish_id = dishes.id), 0);
