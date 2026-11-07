-- Undo 20261107150000_following_new_dishes_digest: unschedules the digest cron job, drops the
-- enqueue functions, archives any new-dishes digest jobs to rollback_archive and deletes them,
-- then puts the two notification_jobs checks back to 20261022031000.
-- expect-row-loss: public.notification_jobs

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'social-new-dishes-digest-notifications') then
      perform cron.unschedule('social-new-dishes-digest-notifications');
    end if;
  end if;
end;
$$;

drop function if exists public.enqueue_social_new_dishes_digest_notifications();
drop function if exists app_private.enqueue_social_new_dishes_digest_notifications();

create schema if not exists rollback_archive;
drop table if exists rollback_archive.notification_jobs_20261107150000;
create table rollback_archive.notification_jobs_20261107150000 as
select * from public.notification_jobs where category = 'social_new_dishes_digest';
delete from public.notification_jobs where category = 'social_new_dishes_digest';

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
    'social_like_digest'
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
    'like_digest'
  ));
