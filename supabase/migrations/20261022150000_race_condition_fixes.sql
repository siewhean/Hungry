-- smoke: supabase/smoke/race_conditions.sql
-- Race conditions: read-then-write paths made atomic.
--
-- Every fix below either holds a row lock (FOR NO KEY UPDATE, which does not block
-- foreign-key checks) or takes a transaction-scoped advisory lock on the owning user,
-- outlet or release before the read, so a concurrent request waits and then reads the
-- committed result. Counters recomputed from a snapshot lock the parent row first:
-- in READ COMMITTED the statement after the lock gets a fresh snapshot.
--
--  * assert_portfolio_expected_updated_at: the "changed elsewhere" check was a bare
--    read, so two saves with the same expected timestamp both won. It now locks the
--    portfolio row, which also serialises add/reorder/update/delete/publish.
--  * count-then-insert caps (portfolio create/flag, stall submissions, catalog
--    corrections, merchant claims) can no longer be beaten by parallel requests.
--  * Food Cred daily cap, per-entity dedupe and mission completion award.
--  * Auto-hide after 3 reports (reviews, comments, posts) missed the third report when
--    reports landed together, and a late "under_review" write could undo a hide.
--  * post like/save/share counts, review helpful count, dish rating/review count, profile
--    counters and merchant analytics rollups are recomputed from events, so a parallel
--    writer could leave a stale value.
--  * popular visitor pins: the 6-pin cap and next sort order were checked in the app.
--  * mark_conversation_read: read-then-insert of receipts is now one INSERT .. ON CONFLICT.
--  * bump_dish_draft_confidence: confidence_bumps was incremented from a stale read.
--  * request_my_account_deletion: a double tap hit the unique index and surfaced an error.
--
-- Function bodies are patched in place from their live definition (the bodies of several
-- of these moved to app_private behind public wrappers), so grants and attributes are kept.
-- Each patch is idempotent and fails loudly if the text it expects is not there.
-- Rollback: re-create the previous function bodies from earlier migrations, drop
-- public.mark_conversation_read, public.bump_dish_draft_confidence and the
-- trg_popular_visitor_pin_limit trigger. Leaving the locks in place is always safe.

create or replace function pg_temp.race_patch(
  p_name text,
  p_find text,
  p_replace text,
  p_tag text
) returns void
language plpgsql
as $patch$
declare
  v_oid oid;
  v_patched integer := 0;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.proname = p_name
      and p.prokind = 'f'
  loop
    if (select position(p_tag in prosrc) > 0 from pg_proc where oid = v_oid) then
      v_patched := v_patched + 1;
      continue;
    end if;
    if (select (length(prosrc) - length(replace(prosrc, p_find, ''))) = length(p_find)
        from pg_proc where oid = v_oid) then
      execute replace(pg_get_functiondef(v_oid), p_find, p_replace);
      v_patched := v_patched + 1;
    end if;
  end loop;
  if v_patched = 0 then
    raise exception 'race_patch: no live definition of % contains the expected text (%)', p_name, p_tag;
  end if;
end;
$patch$;

select pg_temp.race_patch('enforce_portfolio_creation_rate_limit',
$f$if auth.uid() is not null and new.owner_id = auth.uid() then$f$,
$f$if auth.uid() is not null and new.owner_id = auth.uid() then
    -- race:portfolio-create
    perform pg_advisory_xact_lock(hashtextextended('portfolio_create:' || new.owner_id::text, 0));$f$,
'race:portfolio-create');

select pg_temp.race_patch('enforce_portfolio_flag_rate_limit',
$f$if auth.uid() is not null and new.reporter_id = auth.uid() then$f$,
$f$if auth.uid() is not null and new.reporter_id = auth.uid() then
    -- race:portfolio-flag
    perform pg_advisory_xact_lock(hashtextextended('portfolio_flag:' || new.reporter_id::text, 0));$f$,
'race:portfolio-flag');

select pg_temp.race_patch('enforce_user_stall_submission_limits',
$f$if char_length(coalesce(new.stall_name, '')) > 120$f$,
$f$-- race:stall-submission
  perform pg_advisory_xact_lock(hashtextextended('stall_submission:' || new.user_id::text, 0));
  if char_length(coalesce(new.stall_name, '')) > 120$f$,
'race:stall-submission');

select pg_temp.race_patch('submit_catalog_correction',
$f$-- The same open report from the same diner is already in the queue.$f$,
$f$-- race:catalog-correction (dedupe and the daily cap are read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('catalog_correction:' || v_user::text, 0));
  -- The same open report from the same diner is already in the queue.$f$,
'race:catalog-correction');

select pg_temp.race_patch('submit_merchant_claim_interest',
$f$-- An existing claim for this venue is returned as "already exists" without counting.$f$,
$f$-- race:claim-interest (the 24 hour cap is read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('claim_interest:' || auth.uid()::text, 0));
  -- An existing claim for this venue is returned as "already exists" without counting.$f$,
'race:claim-interest');

select pg_temp.race_patch('award_food_cred',
$f$if normalized_action = 'mission_completed' then$f$,
$f$-- race:food-cred (daily cap and dedupe are read-then-insert)
  perform pg_advisory_xact_lock(hashtextextended('food_cred:' || current_user_id::text, 0));
  if normalized_action = 'mission_completed' then$f$,
'race:food-cred');

select pg_temp.race_patch('increment_mission_progress',
$f$for mission_row in$f$,
$f$-- race:mission-progress (completion is detected from a prior read)
  perform pg_advisory_xact_lock(hashtextextended('food_cred:' || current_user_id::text, 0));
  for mission_row in$f$,
'race:mission-progress');

select pg_temp.race_patch('reorder_checklist_items',
$f$select count(*) into v_expected_count$f$,
$f$-- race:checklist-reorder
  perform 1 from public.checklists where id = p_checklist_id for no key update;

  select count(*) into v_expected_count$f$,
'race:checklist-reorder');

select pg_temp.race_patch('report_content',
$f$insert into content_reports ($f$,
$f$-- race:report-threshold (hold the target so concurrent reports count each other)
  if normalized_target_type = 'post_comment' then
    perform 1 from post_comments pc where pc.id = target_uuid for no key update of pc;
  elsif normalized_target_type = 'review' and target_uuid is not null then
    perform 1 from reviews r where r.id = target_uuid for no key update of r;
  end if;

  insert into content_reports ($f$,
'race:report-threshold');

select pg_temp.race_patch('report_post',
$f$insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)$f$,
$f$-- race:report-threshold (hold the post so concurrent reports count each other)
  perform 1 from public.posts where id = p_post_id for no key update;

  insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)$f$,
'race:report-threshold');

select pg_temp.race_patch('sync_post_engagement_counts',
$f$target_post_id := coalesce(new.post_id, old.post_id);$f$,
$f$target_post_id := coalesce(new.post_id, old.post_id);
  -- race:post-counts (take the row first so the counts below see committed likes)
  perform 1 from public.posts where id = target_post_id for no key update;$f$,
'race:post-counts');

select pg_temp.race_patch('sync_review_helpful_count',
$f$update public.reviews r$f$,
$f$-- race:helpful-count (take the row first so the count below sees committed votes)
  perform 1 from public.reviews where id = v_review_id for no key update;

  update public.reviews r$f$,
'race:helpful-count');

select pg_temp.race_patch('refresh_dish_review_stats',
$f$update public.dishes d$f$,
$f$-- race:dish-review-stats (take the row first so the stats below see committed reviews)
  select d.id from public.dishes d where d.id = p_dish_id for no key update;

  update public.dishes d$f$,
'race:dish-review-stats');

select pg_temp.race_patch('refresh_user_profile_counters',
$f$with counts as ($f$,
$f$-- race:profile-counters
  select pg_advisory_xact_lock(hashtextextended('profile_counters:' || p_user_id::text, 0));

  with counts as ($f$,
'race:profile-counters');

select pg_temp.race_patch('refresh_merchant_analytics_daily_rollup',
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
$f$,
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  -- race:merchant-rollup (recomputed from events, so run one at a time per outlet and day)
  perform pg_advisory_xact_lock(hashtextextended('merchant_rollup:' || p_outlet_id::text || ':' || p_metric_date::text, 0));

$f$,
'race:merchant-rollup');

select pg_temp.race_patch('refresh_merchant_dish_analytics_daily',
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
$f$,
$f$v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  -- race:merchant-dish-rollup (recomputed from events, so run one at a time per dish and day)
  perform pg_advisory_xact_lock(hashtextextended('merchant_dish_rollup:' || p_outlet_id::text || ':' || p_dish_id || ':' || p_metric_date::text, 0));

$f$,
'race:merchant-dish-rollup');

select pg_temp.race_patch('catalog_raw_publish_release',
$f$insert into public.catalog_releases (id, status) values (v_release_id, 'building');$f$,
$f$-- race:catalog-publish (one publish at a time, so the active release swap cannot interleave)
  perform pg_advisory_xact_lock(hashtextextended('catalog_raw_publish_release', 0));
  insert into public.catalog_releases (id, status) values (v_release_id, 'building');$f$,
'race:catalog-publish');

select pg_temp.race_patch('request_my_account_deletion',
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

-- ---------------------------------------------------------------------------
-- Portfolio optimistic version check: lock the row, then compare.
-- Called first by every list mutation, so the lock is held to the end of the
-- calling transaction and the next writer re-reads the new updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.assert_portfolio_expected_updated_at(
  p_portfolio_id uuid,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_at timestamptz;
begin
  -- Locked even without an expected version: add/reorder/publish also read-then-write.
  select p.updated_at
  into v_updated_at
  from public.portfolios p
  where p.id = p_portfolio_id
  for no key update;

  if p_expected_updated_at is null then
    return;
  end if;

  if v_updated_at is distinct from p_expected_updated_at then
    raise exception 'This portfolio changed elsewhere. Review the latest version before saving again.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Popular visitor pins: at most 6 active per outlet, next sort order assigned
-- under a per-outlet lock (the app used to count, then upsert).
-- ---------------------------------------------------------------------------
create or replace function app_private.enforce_popular_visitor_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    perform pg_advisory_xact_lock(hashtextextended('popular_pins:' || new.outlet_id::text, 0));

    if (
      select count(*)
      from public.merchant_popular_visitor_pins p
      where p.outlet_id = new.outlet_id
        and p.is_active
        and p.review_id is distinct from new.review_id
    ) >= 6 then
      raise exception 'A stall can feature up to 6 popular visitors.' using errcode = '54000';
    end if;

    new.sort_order := coalesce((
      select max(p.sort_order) + 1
      from public.merchant_popular_visitor_pins p
      where p.outlet_id = new.outlet_id
        and p.is_active
        and p.review_id is distinct from new.review_id
    ), 0);
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_popular_visitor_pin_limit() from public, anon, authenticated;

drop trigger if exists trg_popular_visitor_pin_limit on public.merchant_popular_visitor_pins;
create trigger trg_popular_visitor_pin_limit
  before insert or update of is_active on public.merchant_popular_visitor_pins
  for each row
  execute function app_private.enforce_popular_visitor_pin_limit();

-- ---------------------------------------------------------------------------
-- Mark a conversation read in one statement (was: select existing receipts,
-- then insert the missing ones, so two tabs raced into the unique index).
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    return;
  end if;

  update public.conversation_participants cp
  set last_read_at = v_now
  where cp.conversation_id = p_conversation_id
    and cp.participant_user_id = v_user_id;

  insert into public.read_receipts (message_id, conversation_id, reader_user_id, read_at)
  select m.id, m.conversation_id, v_user_id, v_now
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.deleted_at is null
    and m.sender_user_id is distinct from v_user_id
  on conflict do nothing;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Menu OCR: bump a draft's confidence in one UPDATE (was: read, add one, write).
-- ---------------------------------------------------------------------------
create or replace function public.bump_dish_draft_confidence(
  p_draft_id uuid,
  p_confidence numeric
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.dishes_draft
  set extraction_confidence = greatest(extraction_confidence, least(greatest(coalesce(p_confidence, 0), 0), 1)),
      confidence_bumps = confidence_bumps + 1,
      updated_at = now()
  where id = p_draft_id;
$$;

revoke all on function public.bump_dish_draft_confidence(uuid, numeric) from public, anon, authenticated;
grant execute on function public.bump_dish_draft_confidence(uuid, numeric) to service_role;
