-- Undo 20261112090000_audit_batch_fixes: puts the patched function bodies, the reviews insert
-- trigger, the collaborator RPC, the pin trigger and the block-check grant back as they were.
-- down-loses-data: dishes_draft.review_notes (reviewer notes written after the migration).

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

select pg_temp.patch_function(
  'app_private.unlock_board_achievements()'::regprocedure,
  $find$    from public.follows f
    where f.status = 'approved'
      -- achievement:eligible-followers (accounts Trending leaves out, or blocked, do not count)
      and app_private.leaderboard_actor_is_eligible(f.follower_id)
      and not app_private.app_user_block_exists(f.follower_id, f.followee_id)
    group by f.followee_id$find$,
  $repl$    from public.follows f
    where f.status = 'approved'
    group by f.followee_id$repl$
);
select pg_temp.patch_function(
  'app_private.enforce_merchant_dish_child_draft_scope()'::regprocedure,
  $find$  -- draft:moved-row (moving a photo, flag or taste row off a dish diners can see needs the
  -- same verified stall as changing it there)
  if tg_op = 'UPDATE' then
    if old.dish_id is distinct from new.dish_id then
      select d.venue_id, d.merchant_draft into v_venue_id, v_draft
      from public.dishes d
      where d.id = old.dish_id;
      if v_venue_id is not null and not coalesce(v_draft, false)
        and not public.merchant_venue_is_verified(v_venue_id) then
        raise exception 'Verify your stall to change dishes diners can already see.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  v_dish_id := case when tg_op = 'DELETE' then old.dish_id else new.dish_id end;$find$,
  $repl$  v_dish_id := case when tg_op = 'DELETE' then old.dish_id else new.dish_id end;$repl$
);
select pg_temp.patch_function(
  'app_private.enforce_user_stall_submission_limits()'::regprocedure,
  $find$  -- stall-submission:own-photos (photos must be the submitter's own files in the stall bucket)
  if (new.image_storage_path is not null or new.image_storage_bucket is not null)
    and (
      new.image_storage_bucket is distinct from 'user-stall-submission-images'
      or new.image_storage_path is null
      or split_part(new.image_storage_path, '/', 1) <> new.user_id::text
      or position('..' in new.image_storage_path) > 0
    )
  then
    raise exception 'Stall photos must be your own uploads.' using errcode = '42501';
  end if;
  if jsonb_typeof(new.gallery_images) = 'array' and exists (
    select 1
    from jsonb_array_elements(new.gallery_images) as g(item)
    where (g.item ? 'bucket' or g.item ? 'path')
      and (
        g.item ->> 'bucket' is distinct from 'user-stall-submission-images'
        or split_part(coalesce(g.item ->> 'path', ''), '/', 1) <> new.user_id::text
        or position('..' in coalesce(g.item ->> 'path', '')) > 0
      )
  ) then
    raise exception 'Stall photos must be your own uploads.' using errcode = '42501';
  end if;

  if jsonb_array_length(new.menu_items) > 50$find$,
  $repl$  if jsonb_array_length(new.menu_items) > 50$repl$
);
select pg_temp.patch_function(
  'app_private.record_taste_interaction_event(text,text,double precision[],double precision[],text,text,text,text,numeric,boolean,numeric,text,timestamp with time zone,jsonb)'::regprocedure,
  $find$  -- taste:server-time (the client clock no longer sets the stored time or the cap window)
  v_created_at timestamptz := now();$find$,
  $repl$  v_created_at timestamptz := coalesce(p_created_at, now());$repl$
);
select pg_temp.patch_function(
  'app_private.reorder_portfolio_items(uuid,uuid[],timestamp with time zone)'::regprocedure,
  $find$  -- reorder:one-update (every position set in one statement)
  update public.portfolio_items pi
  set position = requested.ord - 1,
      updated_at = now()
  from unnest(p_item_ids) with ordinality as requested(item_id, ord)
  where pi.id = requested.item_id
    and pi.portfolio_id = p_portfolio_id;$find$,
  $repl$  foreach v_item_id in array p_item_ids
  loop
    update public.portfolio_items
    set position = v_position,
        updated_at = now()
    where id = v_item_id
    and portfolio_id = p_portfolio_id;

    v_position := v_position + 1;
  end loop;$repl$
);
select pg_temp.patch_function(
  'app_private.reorder_portfolio_items(uuid,uuid[],timestamp with time zone)'::regprocedure,
  $find$  -- reorder:no-duplicates (an id listed twice no longer passes the distinct count)
  select case when count(*) = count(distinct item_id) then count(*) else -1 end
  into v_requested_count$find$,
  $repl$  select count(distinct item_id) into v_requested_count$repl$
);
select pg_temp.patch_function(
  'app_private.reorder_checklist_items(uuid,uuid[])'::regprocedure,
  $find$  -- reorder:one-update (every position set in one statement)
  update public.checklist_items ci
  set position = requested.ord - 1,
      updated_at = now()
  from unnest(p_item_ids) with ordinality as requested(item_id, ord)
  where ci.id = requested.item_id
    and ci.checklist_id = p_checklist_id;$find$,
  $repl$  foreach v_item_id in array p_item_ids
  loop
    update public.checklist_items
    set position = v_position,
        updated_at = now()
    where id = v_item_id
    and checklist_id = p_checklist_id;

    v_position := v_position + 1;
  end loop;$repl$
);
select pg_temp.patch_function(
  'app_private.reorder_checklist_items(uuid,uuid[])'::regprocedure,
  $find$  -- reorder:no-duplicates (an id listed twice no longer passes the distinct count)
  select case when count(*) = count(distinct item_id) then count(*) else -1 end
  into v_requested_count$find$,
  $repl$  select count(distinct item_id) into v_requested_count$repl$
);
select pg_temp.patch_function(
  'app_private.reset_sold_out_dishes()'::regprocedure,
  $find$  -- n-plus-one-ok: catalog_raw_refresh_venue rebuilds one stall's cards; this nightly job only
  -- walks the stalls whose sold-out flags it just cleared.
  foreach v_venue_id in array coalesce(v_venues, '{}'::text[]) loop$find$,
  $repl$  foreach v_venue_id in array coalesce(v_venues, '{}'::text[]) loop$repl$
);
select pg_temp.patch_function(
  'app_private.approve_merchant_claim(uuid)'::regprocedure,
  $find$begin
  -- claim:lock-order (the stall lock is taken before the claim row, so two approvals for one
  -- stall wait on the stall lock instead of deadlocking on each other's claim rows)
  perform pg_advisory_xact_lock(hashtextextended('merchant_claim_venue:' || c.venue_id, 0))
  from public.merchant_claim_interests c
  where c.id = p_claim_id;

  select * into v_claim
  from public.merchant_claim_interests c
  where c.id = p_claim_id
  for update;$find$,
  $repl$begin
  select * into v_claim
  from public.merchant_claim_interests c
  where c.id = p_claim_id
  for update;$repl$
);
select pg_temp.patch_function(
  'app_private.reviews_set_edited_at()'::regprocedure,
  $find$begin
  -- review:edited-at-insert (a new review is never marked edited by its author's client)
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.edited_at := null;
    end if;
    return new;
  end if;
  -- Only the author's own change to the review content counts as an edit; the client$find$,
  $repl$begin
  -- Only the author's own change to the review content counts as an edit; the client$repl$
);
select pg_temp.patch_function(
  'app_private.catalog_raw_refresh_venue_deferred()'::regprocedure,
  $find$    if tg_op = 'DELETE' then v_venue_id := old.venue_id; else v_venue_id := new.venue_id; end if;
    -- catalog:moved-dish (the stall a dish moved away from is rebuilt too)
    if tg_op = 'UPDATE' then
      if old.venue_id is not null and old.venue_id is distinct from new.venue_id then
        v_marker := 'hungry.catalog_refreshed_' || md5(old.venue_id);
        if coalesce(current_setting(v_marker, true), '') <> '1' then
          perform set_config(v_marker, '1', true);
          perform public.catalog_raw_refresh_venue(old.venue_id);
        end if;
      end if;
    end if;
  else$find$,
  $repl$    if tg_op = 'DELETE' then v_venue_id := old.venue_id; else v_venue_id := new.venue_id; end if;
  else$repl$
);
select pg_temp.patch_function(
  'app_private.enqueue_merchant_low_rating_alert()'::regprocedure,
  $find$    -- dedupe:low-rating-per-account (every merchant account on the stall gets its own alert)
    'low-rating:' || new.id::text || ':' || mo.merchant_account_id::text,$find$,
  $repl$    'low-rating:' || new.id::text,$repl$
);
select pg_temp.patch_function(
  'app_private.record_merchant_action_event(text,text,uuid,text,text,uuid,text,jsonb)'::regprocedure,
  $find$    where id = p_promotion_id
      and v_promotion_event_type is not null;
  end if;$find$,
  $repl$    where id = p_promotion_id;
  end if;$repl$
);
select pg_temp.patch_function(
  'app_private.record_merchant_action_event(text,text,uuid,text,text,uuid,text,jsonb)'::regprocedure,
  $find$    on conflict (dedupe_key) do nothing;

    -- dedupe:promotion-counters (a duplicate promotion event that was skipped is not counted)
    if not found then
      v_promotion_event_type := null;
    end if;

    update merchant_promotions$find$,
  $repl$    on conflict (dedupe_key) do nothing;

    update merchant_promotions$repl$
);

drop trigger if exists trg_keep_popular_visitor_pin_review on public.merchant_popular_visitor_pins;
drop function if exists app_private.keep_popular_visitor_pin_review();

grant execute on function public.app_user_block_exists(uuid, uuid) to authenticated;

alter table public.dishes_draft drop column if exists review_notes;

drop function if exists public.change_portfolio_collaborator(uuid, uuid, text, text, timestamptz);
drop function if exists app_private.lock_portfolio_for_owner_change(uuid, timestamptz);

drop trigger if exists trg_reviews_set_edited_at_insert on public.reviews;
