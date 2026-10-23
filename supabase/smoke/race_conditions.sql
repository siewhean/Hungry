-- Smoke checks for 20261022150000_race_condition_fixes.sql.
-- Structural checks that the live database carries every lock added by the migration
-- (the patched functions keep their `race:` marker comments), plus grants on the new RPCs.
-- Two-session behaviour is covered by supabase/race-harness/run.sh. Read only.

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
    ('enforce_portfolio_creation_rate_limit', 'race:portfolio-create'),
    ('enforce_portfolio_flag_rate_limit', 'race:portfolio-flag'),
    ('enforce_user_stall_submission_limits', 'race:stall-submission'),
    ('submit_catalog_correction', 'race:catalog-correction'),
    ('submit_merchant_claim_interest', 'race:claim-interest'),
    ('award_food_cred', 'race:food-cred'),
    ('increment_mission_progress', 'race:mission-progress'),
    ('reorder_checklist_items', 'race:checklist-reorder'),
    ('report_content', 'race:report-threshold'),
    ('report_post', 'race:report-threshold'),
    ('sync_post_engagement_counts', 'race:post-counts'),
    ('sync_review_helpful_count', 'race:helpful-count'),
    ('refresh_dish_review_stats', 'race:dish-review-stats'),
    ('refresh_user_profile_counters', 'race:profile-counters'),
    ('refresh_merchant_analytics_daily_rollup', 'race:merchant-rollup'),
    ('refresh_merchant_dish_analytics_daily', 'race:merchant-dish-rollup'),
    ('catalog_raw_publish_release', 'race:catalog-publish'),
    ('request_my_account_deletion', 'race:account-deletion')
    ) as t(fn, tag)
  loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app_private')
        and p.proname = rec.fn
        and position(rec.tag in p.prosrc) > 0
    ) then
      raise exception 'Race fix % (%) is missing from the live function body', rec.fn, rec.tag;
    end if;
  end loop;

  if not exists (
    select 1 from pg_proc
    where proname = 'assert_portfolio_expected_updated_at'
      and position('for no key update' in prosrc) > 0
  ) then
    raise exception 'assert_portfolio_expected_updated_at no longer locks the portfolio row';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_popular_visitor_pin_limit'
      and tgrelid = 'public.merchant_popular_visitor_pins'::regclass
      and not tgisinternal
  ) then
    raise exception 'trg_popular_visitor_pin_limit is missing';
  end if;

  if not has_function_privilege('authenticated', 'public.mark_conversation_read(uuid)', 'execute')
     or has_function_privilege('anon', 'public.mark_conversation_read(uuid)', 'execute') then
    raise exception 'mark_conversation_read grants are wrong';
  end if;

  if not has_function_privilege('service_role', 'public.bump_dish_draft_confidence(uuid, numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.bump_dish_draft_confidence(uuid, numeric)', 'execute')
     or has_function_privilege('anon', 'public.bump_dish_draft_confidence(uuid, numeric)', 'execute') then
    raise exception 'bump_dish_draft_confidence must be service_role only';
  end if;
end $$;

select 'RACE_CONDITION_FIXES_OK' as result;
