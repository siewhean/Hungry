-- Undo 20261109150000_portfolio_ranking: drops rank_portfolio_post and get_review_portfolio_ranks
-- and get_my_portfolio_ranking (public wrappers and app_private bodies) and their rate rules, puts set_pinned_posts back to
-- "up to three" and the check back to three. A ranking longer than three is copied to
-- rollback_archive first, then cut to its top three.
-- expect-row-loss: app_private.request_rate_rules

drop function if exists public.rank_portfolio_post(uuid, integer);
drop function if exists app_private.rank_portfolio_post(uuid, integer);
drop function if exists public.get_my_portfolio_ranking();
drop function if exists app_private.get_my_portfolio_ranking();
drop function if exists public.get_review_portfolio_ranks(uuid[]);
drop function if exists app_private.get_review_portfolio_ranks(uuid[]);

create schema if not exists rollback_archive;

drop table if exists rollback_archive.user_profiles_pinned_post_ids_20261109150000;
create table rollback_archive.user_profiles_pinned_post_ids_20261109150000 as
select id, pinned_post_ids, now() as archived_at
from public.user_profiles
where cardinality(pinned_post_ids) > 3;

update public.user_profiles
set pinned_post_ids = pinned_post_ids[1:3]
where cardinality(pinned_post_ids) > 3;

alter table public.user_profiles drop constraint if exists user_profiles_pinned_post_ids_max;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_pinned_post_ids_max_three'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_pinned_post_ids_max_three
      check (cardinality(pinned_post_ids) <= 3);
  end if;
end $$;

create or replace function app_private.set_pinned_posts(p_post_ids uuid[])
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_kept uuid[];
begin
  if v_user is null then
    raise exception 'Sign in to pin dishes.' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_post_ids, '{}')) > 3 then
    raise exception 'Pin up to three dishes.' using errcode = '22023';
  end if;

  update public.user_profiles up
  set pinned_post_ids = coalesce((
    select array_agg(requested.post_id order by requested.ord)
    from (
      select distinct on (input.post_id) input.post_id, input.ord
      from unnest(coalesce(p_post_ids, '{}')) with ordinality as input(post_id, ord)
      order by input.post_id, input.ord
    ) requested
    join public.posts p on p.id = requested.post_id
    where p.author_id = v_user
      and p.status = 'published'
      and p.deleted_at is null
  ), '{}')
  where up.id = v_user
  returning up.pinned_post_ids into v_kept;

  return coalesce(v_kept, '{}');
end;
$$;

drop table if exists rollback_archive.request_rate_rules_20261109150000;
create table rollback_archive.request_rate_rules_20261109150000
  (like app_private.request_rate_rules including all);
insert into rollback_archive.request_rate_rules_20261109150000
select * from app_private.request_rate_rules
where route in (
  'rpc/rank_portfolio_post', 'rpc/get_my_portfolio_ranking', 'rpc/get_review_portfolio_ranks'
);
delete from app_private.request_rate_rules
where route in (
  'rpc/rank_portfolio_post', 'rpc/get_my_portfolio_ranking', 'rpc/get_review_portfolio_ranks'
);

notify pgrst, 'reload schema';
