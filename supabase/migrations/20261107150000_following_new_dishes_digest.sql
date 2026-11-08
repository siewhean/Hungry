-- smoke: supabase/smoke/following_new_dishes_digest.sql
-- Food Portfolio PR C: one push a day, at 18:00 Singapore time, telling you what the people you
-- follow posted today ("Mei posted 3 dishes at Maxwell"). It opens the Following feed.
--
-- It rides the same outbox and send-notifications worker as the likes digest, so the worker's
-- opt-out (notification_preferences.social_activity), quiet hours, dedupe and weekly cap apply
-- unchanged (every social_ category other than a follow request counts toward the cap). Push
-- itself stays off in the app until notificationsEnabled ships.
--
-- One INSERT .. SELECT builds every follower's digest, grouped in SQL (no loop), with a
-- per-follower-per-day dedupe key and ON CONFLICT DO NOTHING, so two overlapping runs queue one
-- job each.
--
-- Constraints replaced: notification_jobs_category_check and
-- notification_jobs_change_kind_check, based on 20261022031000_social_push_categories.sql.

alter table public.notification_jobs
  drop constraint if exists notification_jobs_category_check;
alter table public.notification_jobs
  add constraint notification_jobs_category_check
  check (category in (
    'stall_update',
    'weekly_picks',
    'merchant_low_rating',
    'mealtime',
    'social_follow_request',
    'social_like_digest',
    'social_new_dishes_digest'
  ));

alter table public.notification_jobs
  drop constraint if exists notification_jobs_change_kind_check;
alter table public.notification_jobs
  add constraint notification_jobs_change_kind_check
  check (change_kind in (
    'new_dish',
    'price_change',
    'back_in_stock',
    'weekly_picks',
    'low_rating',
    'mealtime',
    'follow_request',
    'like_digest',
    'new_dishes_digest'
  ));

create schema if not exists app_private;

-- Today's (Singapore day) published dish posts from the accounts each person follows (approved
-- follows only), leaving out deleted, hidden or removed posts, private posts, blocked pairs and
-- deactivated authors. The body names the author who posted most, and the stall when every post
-- was at one stall.
create or replace function app_private.enqueue_social_new_dishes_digest_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Singapore');
  v_count integer;
begin
  with today_posts as (
    select f.follower_id, p.id as post_id, p.author_id, p.venue_id
    from public.follows f
    join public.posts p on p.author_id = f.followee_id
    where f.status = 'approved'
      and f.follower_id <> f.followee_id
      and p.status = 'published'
      and p.deleted_at is null
      and p.published_at >= v_day_start
      and p.published_at <= now()
      and p.visibility in ('public', 'followers')
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and not app_private.app_user_block_exists(f.follower_id, p.author_id)
      and not app_private.account_is_deactivated(p.author_id)
  ),
  per_author as (
    select follower_id, author_id, count(*) as posts
    from today_posts
    group by follower_id, author_id
  ),
  top_author as (
    select distinct on (pa.follower_id)
      pa.follower_id,
      coalesce(nullif(btrim(up.display_name), ''), 'Someone you follow') as author_name
    from per_author pa
    left join public.user_profiles up on up.id = pa.author_id
    order by pa.follower_id, pa.posts desc, pa.author_id
  ),
  digest as (
    select
      tp.follower_id,
      count(*) as post_count,
      count(distinct tp.author_id) as author_count,
      count(distinct tp.venue_id) as venue_count,
      count(tp.venue_id) as posts_with_venue,
      min(tp.venue_id) as only_venue_id
    from today_posts tp
    group by tp.follower_id
  )
  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link
  )
  select
    d.follower_id,
    'social_new_dishes_digest',
    'new_dishes_digest',
    concat_ws(':', d.follower_id::text, 'social_new_dishes_digest', v_today::text),
    'New dishes from people you follow',
    concat(
      ta.author_name,
      case
        when d.author_count = 2 then ' and 1 other'
        when d.author_count > 2 then concat(' and ', d.author_count - 1, ' others')
        else ''
      end,
      ' posted ',
      d.post_count,
      case when d.post_count = 1 then ' dish' else ' dishes' end,
      case
        when d.venue_count = 1 and d.posts_with_venue = d.post_count and v.name is not null
          then concat(' at ', v.name)
        else ''
      end,
      ' today.'
    ),
    'https://usehungry.com/following'
  from digest d
  join top_author ta on ta.follower_id = d.follower_id
  left join public.venues v on v.id = d.only_venue_id
  left join public.notification_preferences np on np.user_id = d.follower_id
  where coalesce(np.social_activity, true)
    and exists (select 1 from public.user_push_tokens t where t.user_id = d.follower_id)
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app_private.enqueue_social_new_dishes_digest_notifications()
  from public, anon, authenticated;
grant execute on function app_private.enqueue_social_new_dishes_digest_notifications()
  to service_role;

create or replace function public.enqueue_social_new_dishes_digest_notifications()
returns integer
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.enqueue_social_new_dishes_digest_notifications();
$$;

revoke all on function public.enqueue_social_new_dishes_digest_notifications()
  from public, anon, authenticated;
grant execute on function public.enqueue_social_new_dishes_digest_notifications()
  to service_role;

-- Cron: 10:00 UTC = 18:00 SGT, outside quiet hours and before dinner. The existing
-- send-notifications job drains the outbox every 10 minutes.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'social-new-dishes-digest-notifications') then
      perform cron.unschedule('social-new-dishes-digest-notifications');
    end if;
    perform cron.schedule(
      'social-new-dishes-digest-notifications',
      '0 10 * * *',
      'select public.enqueue_social_new_dishes_digest_notifications()'
    );
  end if;
end;
$$;
