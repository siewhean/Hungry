-- Down for 20261022124500_race_condition_fixes.sql.
-- Takes the locks out again (each patch is reverted to the text it replaced) and drops the
-- objects the up migration added. No data is touched. The app and the menu OCR function now
-- call public.mark_conversation_read and public.bump_dish_draft_confidence, so roll back the
-- app and the ingest-menu-photo function together with this file.

create or replace function pg_temp.race_unpatch(
  p_name text,
  p_find text,
  p_replace text,
  p_tag text
) returns void
language plpgsql
as $unpatch$
declare
  v_oid oid;
  v_done integer := 0;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.proname = p_name
      and p.prokind = 'f'
  loop
    if (select position(p_tag in prosrc) = 0 from pg_proc where oid = v_oid) then
      if (select position(p_find in prosrc) > 0 from pg_proc where oid = v_oid) then
        v_done := v_done + 1;
      end if;
      continue;
    end if;
    if (select (length(prosrc) - length(replace(prosrc, p_replace, ''))) = length(p_replace)
        from pg_proc where oid = v_oid) then
      execute replace(pg_get_functiondef(v_oid), p_replace, p_find);
      v_done := v_done + 1;
    end if;
  end loop;
  if v_done = 0 then
    raise exception 'race_unpatch: no live definition of % has the expected text (%)', p_name, p_tag;
  end if;
end;
$unpatch$;

select pg_temp.race_unpatch('enforce_portfolio_creation_rate_limit',
$f$if auth.uid() is not null and new.owner_id = auth.uid() then$f$,
$f$if auth.uid() is not null and new.owner_id = auth.uid() then
    -- race:portfolio-create
    perform pg_advisory_xact_lock(hashtextextended('portfolio_create:' || new.owner_id::text, 0));$f$,
'race:portfolio-create');

select pg_temp.race_unpatch('enforce_portfolio_flag_rate_limit',
$f$if auth.uid() is not null and new.reporter_id = auth.uid() then$f$,
$f$if auth.uid() is not null and new.reporter_id = auth.uid() then
    -- race:portfolio-flag
    perform pg_advisory_xact_lock(hashtextextended('portfolio_flag:' || new.reporter_id::text, 0));$f$,
'race:portfolio-flag');

select pg_temp.race_unpatch('enforce_user_stall_submission_limits',
$f$if char_length(coalesce(new.stall_name, '')) > 120$f$,
$f$-- race:stall-submission
  perform pg_advisory_xact_lock(hashtextextended('stall_submission:' || new.user_id::text, 0));
  if char_length(coalesce(new.stall_name, '')) > 120$f$,
'race:stall-submission');

select pg_temp.race_unpatch('submit_catalog_correction',
$f$-- The same open report from the same diner is already in the queue.$f$,
$f$-- race:catalog-correction (dedupe and the daily cap are read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('catalog_correction:' || v_user::text, 0));
  -- The same open report from the same diner is already in the queue.$f$,
'race:catalog-correction');

select pg_temp.race_unpatch('submit_merchant_claim_interest',
$f$-- An existing claim for this venue is returned as "already exists" without counting.$f$,
$f$-- race:claim-interest (the 24 hour cap is read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('claim_interest:' || auth.uid()::text, 0));
  -- An existing claim for this venue is returned as "already exists" without counting.$f$,
'race:claim-interest');

select pg_temp.race_unpatch('award_food_cred',
$f$if normalized_action = 'mission_completed' then$f$,
$f$-- race:food-cred (daily cap and dedupe are read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('food_cred:' || current_user_id::text, 0));
  if normalized_action = 'mission_completed' then$f$,
'race:food-cred');

select pg_temp.race_unpatch('increment_mission_progress',
$f$for mission_row in$f$,
$f$-- race:mission-progress (completion is detected from a prior read)
  perform pg_advisory_xact_lock(hashtextextended('food_cred:' || current_user_id::text, 0));
  for mission_row in$f$,
'race:mission-progress');

select pg_temp.race_unpatch('reorder_checklist_items',
$f$select count(*) into v_expected_count$f$,
$f$-- race:checklist-reorder
  perform 1 from public.checklists where id = p_checklist_id for no key update;

  select count(*) into v_expected_count$f$,
'race:checklist-reorder');

select pg_temp.race_unpatch('report_content',
$f$insert into content_reports ($f$,
$f$-- race:report-threshold (hold the target so concurrent reports count each other)
  if normalized_target_type = 'post_comment' then
    perform 1 from post_comments pc where pc.id = target_uuid for no key update of pc;
  elsif normalized_target_type = 'review' and target_uuid is not null then
    perform 1 from reviews r where r.id = target_uuid for no key update of r;
  end if;

  insert into content_reports ($f$,
'race:report-threshold');

select pg_temp.race_unpatch('report_post',
$f$insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)$f$,
$f$-- race:report-threshold (hold the post so concurrent reports count each other)
  perform 1 from public.posts where id = p_post_id for no key update;

  insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)$f$,
'race:report-threshold');

select pg_temp.race_unpatch('sync_post_engagement_counts',
$f$target_post_id := coalesce(new.post_id, old.post_id);$f$,
$f$target_post_id := coalesce(new.post_id, old.post_id);
  -- race:post-counts (take the row first so the counts below see committed likes)
  perform 1 from public.posts where id = target_post_id for no key update;$f$,
'race:post-counts');

select pg_temp.race_unpatch('sync_review_helpful_count',
$f$update public.reviews r$f$,
$f$-- race:helpful-count (take the row first so the count below sees committed votes)
  perform 1 from public.reviews where id = v_review_id for no key update;

  update public.reviews r$f$,
'race:helpful-count');

select pg_temp.race_unpatch('refresh_dish_review_stats',
$f$update public.dishes d$f$,
$f$-- race:dish-review-stats (take the row first so the stats below see committed reviews)
  select d.id from public.dishes d where d.id = p_dish_id for no key update;

  update public.dishes d$f$,
'race:dish-review-stats');

select pg_temp.race_unpatch('refresh_user_profile_counters',
$f$with counts as ($f$,
$f$-- race:profile-counters
  select pg_advisory_xact_lock(hashtextextended('profile_counters:' || p_user_id::text, 0));

  with counts as ($f$,
'race:profile-counters');

select pg_temp.race_unpatch('refresh_merchant_analytics_daily_rollup',
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
$f$,
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  -- race:merchant-rollup (recomputed from events, so run one at a time per outlet and day)
  perform pg_advisory_xact_lock(hashtextextended('merchant_rollup:' || p_outlet_id::text || ':' || p_metric_date::text, 0));

$f$,
'race:merchant-rollup');

select pg_temp.race_unpatch('refresh_merchant_dish_analytics_daily',
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
$f$,
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  -- race:merchant-dish-rollup (recomputed from events, so run one at a time per dish and day)
  perform pg_advisory_xact_lock(hashtextextended('merchant_dish_rollup:' || p_outlet_id::text || ':' || p_dish_id || ':' || p_metric_date::text, 0));

$f$,
'race:merchant-dish-rollup');

select pg_temp.race_unpatch('catalog_raw_publish_release',
$f$insert into public.catalog_releases (id, status) values (v_release_id, 'building');$f$,
$f$-- race:catalog-publish (one publish at a time, so the active release swap cannot interleave)
  perform pg_advisory_xact_lock(hashtextextended('catalog_raw_publish_release', 0));
  insert into public.catalog_releases (id, status) values (v_release_id, 'building');$f$,
'race:catalog-publish');

select pg_temp.race_unpatch('request_my_account_deletion',
$f$  insert into public.account_deletion_requests (user_id, reason)
  values (v_user_id, left(nullif(trim(coalesce(p_reason, '')), ''), 200))
  returning scheduled_for into v_scheduled_for;
$f$,
$f$  -- race:account-deletion (the unique active-request index decides a double tap)
  insert into public.account_deletion_requests (user_id, reason)
  values (v_user_id, left(nullif(trim(coalesce(p_reason, '')), ''), 200))
  on conflict do nothing
  returning scheduled_for into v_scheduled_for;

  if v_scheduled_for is null then
    select adr.scheduled_for
    into v_scheduled_for
    from public.account_deletion_requests adr
    where adr.user_id = v_user_id
      and adr.status in ('requested', 'processing')
    order by adr.created_at desc
    limit 1;
  end if;
$f$,
'race:account-deletion');

create or replace function public.assert_portfolio_expected_updated_at(
  p_portfolio_id uuid,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_expected_updated_at is null then
    return;
  end if;

  if not exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
      and p.updated_at = p_expected_updated_at
  ) then
    raise exception 'This portfolio changed elsewhere. Review the latest version before saving again.';
  end if;
end;
$$;

drop trigger if exists trg_popular_visitor_pin_limit on public.merchant_popular_visitor_pins;
drop function if exists app_private.enforce_popular_visitor_pin_limit();
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.bump_dish_draft_confidence(uuid, numeric);
