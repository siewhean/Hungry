-- Taste engine plan, phase 4: log which dishes a recommendation surface showed, so the share
-- of shown picks that people tap, save or rate well can be measured week to week.
-- Taps already land in taste_interaction_events; this adds the "shown" side.

create table if not exists public.recommendation_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  surface text not null,
  dish_ids text[] not null check (cardinality(dish_ids) between 1 and 50),
  created_at timestamptz not null default now()
);

create index if not exists recommendation_impressions_user_created_idx
  on public.recommendation_impressions (user_id, created_at desc);

create index if not exists recommendation_impressions_created_idx
  on public.recommendation_impressions (created_at desc);

alter table public.recommendation_impressions enable row level security;

drop policy if exists "recommendation_impressions_insert_own" on public.recommendation_impressions;
create policy "recommendation_impressions_insert_own"
on public.recommendation_impressions for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "recommendation_impressions_select_own" on public.recommendation_impressions;
create policy "recommendation_impressions_select_own"
on public.recommendation_impressions for select to authenticated
using ((select auth.uid()) = user_id);

-- Weekly tap rate per surface: a shown dish counts as engaged when the same user taps, likes,
-- saves, rates or acts on it within an hour of seeing it. Service role only (dashboards, SQL editor).
create or replace function public.recommendation_tap_rate(p_weeks integer default 8)
returns table (
  week_start date,
  surface text,
  dishes_shown bigint,
  dishes_engaged bigint,
  tap_rate numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with shown as (
    select
      ri.id,
      ri.user_id,
      ri.surface,
      ri.created_at,
      shown_dish.dish_id
    from recommendation_impressions ri
    cross join lateral unnest(ri.dish_ids) as shown_dish(dish_id)
    where ri.created_at >= date_trunc('week', now())
      - make_interval(weeks => least(greatest(coalesce(p_weeks, 8), 1), 52) - 1)
  ),
  engaged as (
    select
      s.*,
      exists (
        select 1
        from taste_interaction_events e
        where e.user_id = s.user_id
          and e.dish_id = s.dish_id
          and e.created_at between s.created_at and s.created_at + interval '1 hour'
          and (
            e.type in ('dish_result_click', 'dish_like', 'saved', 'review', 'food_button_click')
            or (e.type = 'rating' and coalesce(e.rating, 0) >= 4)
          )
      ) as is_engaged
    from shown s
  )
  select
    date_trunc('week', created_at)::date as week_start,
    surface,
    count(*) as dishes_shown,
    count(*) filter (where is_engaged) as dishes_engaged,
    round(count(*) filter (where is_engaged)::numeric / nullif(count(*), 0), 4) as tap_rate
  from engaged
  group by 1, 2
  order by 1 desc, 2;
$$;

revoke execute on function public.recommendation_tap_rate(integer) from public, anon, authenticated;
grant execute on function public.recommendation_tap_rate(integer) to service_role;
