-- Smoke checks for 20261022050100_popular_visitor_pins_blocked_and_fresh.sql.
-- Pins of a blocked or reported author are hidden by a restrictive select policy
-- (the outlet's own managers still see them), and editing a review re-copies the
-- pin snapshot through an after-update trigger. Runs in a transaction and rolls back.

begin;

do $$
declare
  policy_row record;
begin
  select * into policy_row
  from pg_policies
  where schemaname = 'public'
    and tablename = 'merchant_popular_visitor_pins'
    and policyname = 'popular_visitor_pins_hide_blocked_or_reported';

  if policy_row.policyname is null then
    raise exception 'popular_visitor_pins_hide_blocked_or_reported policy is missing';
  end if;
  if policy_row.permissive <> 'RESTRICTIVE' then
    raise exception 'the blocked-author policy must be restrictive so it narrows, not widens, access';
  end if;
  if policy_row.cmd <> 'SELECT' then
    raise exception 'the blocked-author policy must apply to select only';
  end if;
  if policy_row.qual !~ 'can_read_review' then
    raise exception 'the policy must reuse app_private.can_read_review';
  end if;
  if policy_row.qual !~ 'merchant_can_manage_outlet_v2' then
    raise exception 'outlet managers must still see every pin so they can unpin';
  end if;

  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.reviews'::regclass
      and t.tgname = 'trg_reviews_refresh_popular_visitor_pins'
      and not t.tgisinternal
  ) then
    raise exception 'trg_reviews_refresh_popular_visitor_pins is missing';
  end if;

  if has_function_privilege('authenticated', 'app_private.refresh_popular_visitor_pins_for_review()', 'execute')
     or has_function_privilege('anon', 'app_private.refresh_popular_visitor_pins_for_review()', 'execute') then
    raise exception 'the pin refresh function must not be callable by clients';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_popular_visitor_pins_review'
  ) then
    raise exception 'idx_popular_visitor_pins_review is missing';
  end if;
end $$;

rollback;
