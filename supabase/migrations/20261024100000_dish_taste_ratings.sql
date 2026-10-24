-- smoke: supabase/smoke/dish_taste_ratings.sql
-- Reviewers' optional "How did it taste?" ratings (review editor, round 8).
--
-- The app turns what the reviewer felt into the dish's standard level with their own
-- palate before it sends it (src/features/detail/perceivedTaste.ts standardTasteRating),
-- so every row is on the same 0-10 standard scale as dish_taste_vectors.
-- One row per diner per dish: rating the same dish again replaces the earlier rating in
-- one INSERT .. ON CONFLICT (no read-then-write). Each axis is optional (null = not rated).
-- Rows are private to their author; the dish summary function only returns averages,
-- and only once at least 3 diners rated an axis. Deleting the account deletes the rows.
-- Rollback: supabase/rollbacks/20261024100000_dish_taste_ratings.down.sql.

create table if not exists public.dish_taste_ratings (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  dish_id text not null references public.dishes(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  sweet numeric(3, 1) check (sweet between 0 and 10),
  spicy numeric(3, 1) check (spicy between 0 and 10),
  sour numeric(3, 1) check (sour between 0 and 10),
  salty numeric(3, 1) check (salty between 0 and 10),
  rich numeric(3, 1) check (rich between 0 and 10),
  aromatic numeric(3, 1) check (aromatic between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, dish_id),
  constraint dish_taste_ratings_has_an_axis check (
    num_nonnulls(sweet, spicy, sour, salty, rich, aromatic) > 0
  )
);

create index if not exists dish_taste_ratings_dish_idx on public.dish_taste_ratings (dish_id);
create index if not exists dish_taste_ratings_review_idx on public.dish_taste_ratings (review_id)
  where review_id is not null;

alter table public.dish_taste_ratings enable row level security;

revoke all on public.dish_taste_ratings from anon, authenticated;
grant select, delete on public.dish_taste_ratings to authenticated;

drop policy if exists dish_taste_ratings_select_own on public.dish_taste_ratings;
create policy dish_taste_ratings_select_own on public.dish_taste_ratings
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists dish_taste_ratings_delete_own on public.dish_taste_ratings;
create policy dish_taste_ratings_delete_own on public.dish_taste_ratings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Writes go through this function only, so the shape is checked in one place.
create or replace function public.submit_dish_taste_rating(
  p_dish_id text,
  p_rating jsonb,
  p_review_id uuid default null
) returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_review uuid;
  v_sweet numeric;
  v_spicy numeric;
  v_sour numeric;
  v_salty numeric;
  v_rich numeric;
  v_aromatic numeric;
begin
  if v_user is null then
    raise exception 'sign in to rate a dish' using errcode = '42501';
  end if;
  if p_rating is null or jsonb_typeof(p_rating) <> 'object' then
    raise exception 'rating must be an object' using errcode = '22023';
  end if;

  v_sweet := round((p_rating ->> 'sweet')::numeric, 1);
  v_spicy := round((p_rating ->> 'spicy')::numeric, 1);
  v_sour := round((p_rating ->> 'sour')::numeric, 1);
  v_salty := round((p_rating ->> 'salty')::numeric, 1);
  v_rich := round((p_rating ->> 'rich')::numeric, 1);
  v_aromatic := round((p_rating ->> 'aromatic')::numeric, 1);

  -- Only link a review the caller wrote for this dish.
  if p_review_id is not null then
    select r.id into v_review
    from public.reviews r
    where r.id = p_review_id and r.user_id = v_user and r.dish_id = p_dish_id;
  end if;

  insert into public.dish_taste_ratings as t (
    user_id, dish_id, review_id, sweet, spicy, sour, salty, rich, aromatic
  ) values (
    v_user, p_dish_id, v_review, v_sweet, v_spicy, v_sour, v_salty, v_rich, v_aromatic
  )
  on conflict (user_id, dish_id) do update set
    review_id = coalesce(excluded.review_id, t.review_id),
    sweet = excluded.sweet,
    spicy = excluded.spicy,
    sour = excluded.sour,
    salty = excluded.salty,
    rich = excluded.rich,
    aromatic = excluded.aromatic,
    updated_at = now();
end;
$$;

revoke all on function public.submit_dish_taste_rating(text, jsonb, uuid) from public, anon;
grant execute on function public.submit_dish_taste_rating(text, jsonb, uuid) to authenticated;

-- Community averages per axis for one dish, hidden until 3 diners rated that axis.
create or replace function public.get_dish_taste_rating_summary(p_dish_id text)
returns table (axis text, average numeric, rater_count integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.axis, round(avg(v.level), 1), count(*)::integer
  from public.dish_taste_ratings t
  cross join lateral (values
    ('sweet', t.sweet), ('spicy', t.spicy), ('sour', t.sour),
    ('salty', t.salty), ('rich', t.rich), ('aromatic', t.aromatic)
  ) as v(axis, level)
  where t.dish_id = p_dish_id and v.level is not null
  group by v.axis
  having count(*) >= 3
$$;

revoke all on function public.get_dish_taste_rating_summary(text) from public, anon;
grant execute on function public.get_dish_taste_rating_summary(text) to authenticated, service_role;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/submit_dish_taste_rating', null, 20, 'review editor taste ratings, one per published review')
on conflict (route) do nothing;
