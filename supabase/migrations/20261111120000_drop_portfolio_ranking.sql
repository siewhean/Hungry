-- smoke: supabase/smoke/drop_portfolio_ranking.sql
-- expect-row-loss: app_private.request_rate_rules
-- Food Portfolio Phase 2 cleanup (roadmap 2.7). The ranking model is gone from the app since #266:
-- the portfolio is now bests by dish type, an optional top three (public.portfolio_picks) and a
-- diary. This drops what only the ranking used.
--
-- 1. submit_review no longer ranks the entry it makes (the `rank` key in p_portfolio was the last
--    caller of rank_portfolio_post; the app stopped sending it in #266). A rank still sent by an
--    old build is ignored.
-- 2. Drops set_pinned_posts, rank_portfolio_post, get_my_portfolio_ranking,
--    get_review_portfolio_ranks and get_food_portfolio_top_posts (public wrappers and app_private
--    bodies) and their rate rules. Builds older than #266 lose the ranking screens and the old
--    top three; current builds read get_portfolio_picks.
-- 3. Drops user_profiles.pinned_post_ids and its check. Its values (the overall picks were copied
--    from it in 20261111090000) are kept in rollback_archive for the down migration.
--
-- Rollback: supabase/rollbacks/20261111120000_drop_portfolio_ranking.down.sql.

-- Replaces one exact piece of a live function body. Already patched (p_replace present and
-- p_find gone) is a no-op; anything else that does not find exactly one copy stops the migration.
create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 and position(p_replace in v_src) > 0 then
    return;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

-- 1. submit_review stops ranking.
select pg_temp.patch_function(
  'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure,
  $find$    v_post_resumed := coalesce((v_entry ->> 'resumed')::boolean, false);
    if not v_post_resumed and jsonb_typeof(p_portfolio -> 'rank') = 'number' then
      perform app_private.rank_portfolio_post(v_post_id, (p_portfolio ->> 'rank')::integer);
    end if;
  end if;$find$,
  $replace$    v_post_resumed := coalesce((v_entry ->> 'resumed')::boolean, false);
  end if;$replace$
);

-- 2. The ranking RPCs.
drop function if exists public.set_pinned_posts(uuid[]);
drop function if exists app_private.set_pinned_posts(uuid[]);
drop function if exists public.rank_portfolio_post(uuid, integer);
drop function if exists app_private.rank_portfolio_post(uuid, integer);
drop function if exists public.get_my_portfolio_ranking();
drop function if exists app_private.get_my_portfolio_ranking();
drop function if exists public.get_review_portfolio_ranks(uuid[]);
drop function if exists app_private.get_review_portfolio_ranks(uuid[]);
drop function if exists public.get_food_portfolio_top_posts(uuid);
drop function if exists app_private.get_food_portfolio_top_posts(uuid);

delete from app_private.request_rate_rules where route = 'rpc/set_pinned_posts';
delete from app_private.request_rate_rules where route = 'rpc/rank_portfolio_post';
delete from app_private.request_rate_rules where route = 'rpc/get_my_portfolio_ranking';
delete from app_private.request_rate_rules where route = 'rpc/get_review_portfolio_ranks';
delete from app_private.request_rate_rules where route = 'rpc/get_food_portfolio_top_posts';

-- 3. The ranking column, archived first.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'pinned_post_ids'
  ) then
    create schema if not exists rollback_archive;
    drop table if exists rollback_archive.user_profiles_pinned_post_ids_20261111120000;
    create table rollback_archive.user_profiles_pinned_post_ids_20261111120000 as
    select id, pinned_post_ids, now() as archived_at
    from public.user_profiles
    where cardinality(pinned_post_ids) > 0;
  end if;
end $$;

alter table public.user_profiles drop constraint if exists user_profiles_pinned_post_ids_max;
alter table public.user_profiles drop column if exists pinned_post_ids;
