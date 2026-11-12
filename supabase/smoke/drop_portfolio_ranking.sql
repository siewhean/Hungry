-- Smoke checks for 20261111120000_drop_portfolio_ranking.sql.
-- 1. The ranking RPCs (public wrappers and app_private bodies) and their rate rules are gone.
-- 2. user_profiles.pinned_post_ids and its check are gone.
-- 3. submit_review no longer calls rank_portfolio_post, and still makes the linked entry.
-- 4. The picks that replaced the ranking are still there: get_portfolio_picks and its rate rule.
-- Read-only; runs in a transaction and rolls back.

begin;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.proname in (
        'set_pinned_posts', 'rank_portfolio_post', 'get_my_portfolio_ranking',
        'get_review_portfolio_ranks', 'get_food_portfolio_top_posts'
      )
  ) then
    raise exception 'a ranking RPC is still there';
  end if;
  if exists (
    select 1 from app_private.request_rate_rules where route in (
      'rpc/set_pinned_posts', 'rpc/rank_portfolio_post', 'rpc/get_my_portfolio_ranking',
      'rpc/get_review_portfolio_ranks', 'rpc/get_food_portfolio_top_posts'
    )
  ) then
    raise exception 'a rate rule for a dropped RPC is still there';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'pinned_post_ids'
  ) or exists (
    select 1 from pg_constraint where conname = 'user_profiles_pinned_post_ids_max'
  ) then
    raise exception 'user_profiles.pinned_post_ids or its check is still there';
  end if;

  if (select prosrc from pg_proc where oid = 'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure)
    like '%rank_portfolio_post%' then
    raise exception 'submit_review still ranks the entry';
  end if;
  if (select prosrc from pg_proc where oid = 'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure)
    not like '%app_private.publish_post_core(%' then
    raise exception 'submit_review no longer makes the linked entry';
  end if;

  if to_regprocedure('public.get_portfolio_picks(uuid)') is null
    or not exists (select 1 from app_private.request_rate_rules where route = 'rpc/get_portfolio_picks') then
    raise exception 'the portfolio picks read went missing';
  end if;
end $$;

rollback;
