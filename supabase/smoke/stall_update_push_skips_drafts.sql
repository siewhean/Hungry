-- Smoke checks for 20261022050200_stall_update_push_skips_drafts.sql.
-- A merchant_draft dish never enqueues a stall-update push; publishing the menu
-- (draft to live) enqueues one alert per follower, not one per dish. Runs in a
-- transaction and rolls back.

begin;

do $$
declare
  fn_def text;
begin
  select pg_get_functiondef('public.enqueue_stall_update_notifications()'::regprocedure) into fn_def;

  if fn_def !~* 'merchant_draft' then
    raise exception 'enqueue_stall_update_notifications must look at merchant_draft';
  end if;
  if fn_def !~* 'menu_published' then
    raise exception 'publishing a draft menu must dedupe to one alert per follower';
  end if;
  if fn_def !~* 'security definer' then
    raise exception 'enqueue_stall_update_notifications must stay security definer';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.dishes'::regclass
      and t.tgname = 'trg_dishes_enqueue_stall_updates'
      and not t.tgisinternal
      and pg_get_triggerdef(t.oid) ~* 'merchant_draft'
  ) then
    raise exception 'trg_dishes_enqueue_stall_updates must also fire when merchant_draft changes';
  end if;
end $$;

rollback;
