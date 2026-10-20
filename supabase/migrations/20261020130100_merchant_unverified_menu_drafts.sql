-- Unverified merchants can prepare their menu (medium/low decision 27).
--
-- Checked first: base-table RLS already hides an unverified merchant's dishes
-- and photos (public_select_dishes / public_select_dish_images only pass
-- approved merchant_owned/licensed rows). The raw catalog did NOT: the
-- per-venue refresh and the full publish project every dish of a venue into
-- catalog_raw_dish_cards / catalog_raw_dish_media, and the guest-callable
-- catalog_raw_* read RPCs do not filter on rights. So a dish an unverified
-- merchant saved would have reached Search, the stall menu and dish detail.
--
-- 1. dishes.merchant_draft marks a dish an unverified merchant created. The
--    flag is set by trigger, never by the client.
-- 2. Draft dishes (and their photos) are never projected into the raw catalog,
--    and venue cards leave them out of menu count, price, tags and the
--    representative dish. This holds for the per-venue refresh and the full
--    publish, since both insert through the same tables.
-- 3. An unverified merchant can create, edit and delete its own drafts only.
--    Dishes diners can already see (imported or published) stay read-only
--    until the stall is verified, including sold-out/featured toggles,
--    photos, dietary labels and taste vectors.
-- 4. When ops mark the outlet verified, its drafts are published (merchant
--    owned + approved, ops rejections kept) and the venue's catalog cards are
--    rebuilt.
--
-- Full catalog publishes: p_expected_dishes counts must leave drafts out.

begin;

create schema if not exists app_private;

alter table public.dishes
  add column if not exists merchant_draft boolean not null default false;

create index if not exists idx_dishes_merchant_draft_venue
  on public.dishes (venue_id)
  where merchant_draft;

-- ---------------------------------------------------------------------------
-- 1 + 3. Draft flag and unverified write scope on dishes
-- ---------------------------------------------------------------------------

create or replace function app_private.enforce_merchant_dish_draft_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_verified boolean;
begin
  -- Service role, migrations and SECURITY DEFINER jobs are not merchant writes.
  if current_user not in ('authenticated', 'anon') or public.app_is_current_user_ops_admin() then
    return coalesce(new, old);
  end if;

  v_verified := public.merchant_venue_is_verified(
    case when tg_op = 'DELETE' then old.venue_id else new.venue_id end
  );

  if tg_op = 'INSERT' then
    new.merchant_draft := not v_verified;
    return new;
  end if;

  if v_verified then
    if tg_op = 'UPDATE' then
      -- A verified merchant's save publishes the dish (the write guard approves it).
      new.merchant_draft := false;
      return new;
    end if;
    return old;
  end if;

  if not old.merchant_draft then
    raise exception 'Verify your stall to change dishes diners can already see.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.merchant_draft := true;
    return new;
  end if;
  return old;
end;
$$;

revoke all on function app_private.enforce_merchant_dish_draft_scope() from public, anon, authenticated;

drop trigger if exists trg_enforce_merchant_dish_draft_scope on public.dishes;
create trigger trg_enforce_merchant_dish_draft_scope
before insert or update or delete on public.dishes
for each row
execute function app_private.enforce_merchant_dish_draft_scope();

-- Photos, dietary labels and taste vectors follow their dish.
create or replace function app_private.enforce_merchant_dish_child_draft_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_dish_id text;
  v_venue_id text;
  v_draft boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.app_is_current_user_ops_admin() then
    return coalesce(new, old);
  end if;

  v_dish_id := case when tg_op = 'DELETE' then old.dish_id else new.dish_id end;
  select d.venue_id, d.merchant_draft into v_venue_id, v_draft
  from public.dishes d
  where d.id = v_dish_id;

  -- Unknown dish: RLS and the existing write guards decide.
  if v_venue_id is null or v_draft or public.merchant_venue_is_verified(v_venue_id) then
    return coalesce(new, old);
  end if;

  raise exception 'Verify your stall to change dishes diners can already see.'
    using errcode = '42501';
end;
$$;

revoke all on function app_private.enforce_merchant_dish_child_draft_scope() from public, anon, authenticated;

drop trigger if exists trg_enforce_merchant_dish_image_draft_scope on public.dish_images;
create trigger trg_enforce_merchant_dish_image_draft_scope
before insert or update or delete on public.dish_images
for each row
execute function app_private.enforce_merchant_dish_child_draft_scope();

drop trigger if exists trg_enforce_merchant_dish_dietary_draft_scope on public.dish_dietary_flags;
create trigger trg_enforce_merchant_dish_dietary_draft_scope
before insert or update or delete on public.dish_dietary_flags
for each row
execute function app_private.enforce_merchant_dish_child_draft_scope();

drop trigger if exists trg_enforce_merchant_dish_taste_draft_scope on public.dish_taste_vectors;
create trigger trg_enforce_merchant_dish_taste_draft_scope
before insert or update or delete on public.dish_taste_vectors
for each row
execute function app_private.enforce_merchant_dish_child_draft_scope();

-- ---------------------------------------------------------------------------
-- 2. Drafts never reach the raw catalog
-- ---------------------------------------------------------------------------

create or replace function app_private.catalog_raw_skip_merchant_draft_dish()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_dish_id text;
begin
  if tg_table_name = 'catalog_raw_dish_cards' then
    v_dish_id := new.id;
  else
    v_dish_id := new.dish_id;
  end if;
  if exists (select 1 from public.dishes d where d.id = v_dish_id and d.merchant_draft) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function app_private.catalog_raw_skip_merchant_draft_dish() from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_skip_merchant_draft_dish on public.catalog_raw_dish_cards;
create trigger trg_catalog_raw_skip_merchant_draft_dish
before insert on public.catalog_raw_dish_cards
for each row
execute function app_private.catalog_raw_skip_merchant_draft_dish();

drop trigger if exists trg_catalog_raw_skip_merchant_draft_media on public.catalog_raw_dish_media;
create trigger trg_catalog_raw_skip_merchant_draft_media
before insert on public.catalog_raw_dish_media
for each row
execute function app_private.catalog_raw_skip_merchant_draft_dish();

-- Venue cards: recompute the dish-derived fields without drafts, only for a
-- venue that has drafts (the partial index keeps the check cheap).
create or replace function app_private.catalog_raw_venue_card_without_drafts()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from public.dishes d where d.venue_id = new.id and d.merchant_draft) then
    return new;
  end if;

  select coalesce(count(*)::integer, 0), min(d.price)
  into new.menu_count, new.min_price
  from public.dishes d
  where d.venue_id = new.id and not d.merchant_draft;

  select coalesce(array_remove(array_agg(distinct tag), null), '{}')
  into new.cuisine_tags
  from public.dishes d
  left join lateral unnest(d.cuisine_tags) tag on true
  where d.venue_id = new.id and not d.merchant_draft;

  select coalesce(array_agg(distinct dfl.slug order by dfl.slug), '{}')
  into new.dietary_flags
  from public.dishes d
  join public.dish_dietary_flags ddf on ddf.dish_id = d.id
  join public.dietary_flags dfl on dfl.id = ddf.dietary_flag_id
  where d.venue_id = new.id and not d.merchant_draft;

  if exists (
    select 1 from public.dishes d
    where d.id = new.representative_dish ->> 'id' and d.merchant_draft
  ) then
    select
      jsonb_build_object(
        'id', d.id, 'name', d.name, 'image_url', d.image_url, 'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ),
      coalesce(d.rating_avg, 0),
      coalesce(d.review_count, 0)
    into new.representative_dish, new.quality_rating, new.quality_review_count
    from public.dishes d
    where d.venue_id = new.id and not d.merchant_draft
    order by d.rating_avg desc nulls last, d.review_count desc nulls last, d.id
    limit 1;
    if not found then
      new.representative_dish := null;
      new.quality_rating := 0;
      new.quality_review_count := 0;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.catalog_raw_venue_card_without_drafts() from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_venue_card_without_drafts on public.catalog_raw_venue_cards;
create trigger trg_catalog_raw_venue_card_without_drafts
before insert on public.catalog_raw_venue_cards
for each row
execute function app_private.catalog_raw_venue_card_without_drafts();

-- ---------------------------------------------------------------------------
-- 4. Verification publishes the drafts
-- ---------------------------------------------------------------------------

create or replace function app_private.publish_merchant_menu_drafts_on_verify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_venue_id text;
begin
  if new.status <> 'verified'
    or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  select mo.venue_id into v_venue_id
  from public.merchant_outlets mo
  where mo.id = new.outlet_id;

  if v_venue_id is null
    or not exists (select 1 from public.dishes d where d.venue_id = v_venue_id and d.merchant_draft) then
    return new;
  end if;

  update public.dish_images di
  set
    media_rights_status = 'merchant_owned',
    media_approved_for_display = true,
    media_source_url = null,
    media_verified_at = now(),
    media_verified_by = auth.uid()
  from public.dishes d
  where d.id = di.dish_id
    and d.venue_id = v_venue_id
    and d.merchant_draft
    and di.media_rights_status = 'unverified';

  update public.dishes d
  set
    merchant_draft = false,
    menu_approved_for_display = case
      when d.menu_rights_status = 'rejected' then d.menu_approved_for_display else true end,
    menu_rights_status = case
      when d.menu_rights_status = 'rejected' then d.menu_rights_status else 'merchant_owned' end,
    menu_source_url = case when d.menu_rights_status = 'rejected' then d.menu_source_url else null end,
    menu_verified_at = case when d.menu_rights_status = 'rejected' then d.menu_verified_at else now() end,
    menu_verified_by = case when d.menu_rights_status = 'rejected' then d.menu_verified_by else auth.uid() end,
    media_approved_for_display = case
      when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
        then true else d.media_approved_for_display end,
    media_rights_status = case
      when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
        then 'merchant_owned' else d.media_rights_status end,
    media_verified_at = case
      when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
        then now() else d.media_verified_at end
  where d.venue_id = v_venue_id
    and d.merchant_draft;

  perform public.catalog_raw_refresh_venue(v_venue_id);
  return new;
end;
$$;

revoke all on function app_private.publish_merchant_menu_drafts_on_verify() from public, anon, authenticated;

drop trigger if exists trg_publish_merchant_menu_drafts_on_verify on public.merchant_verifications;
create trigger trg_publish_merchant_menu_drafts_on_verify
after insert or update of status on public.merchant_verifications
for each row
execute function app_private.publish_merchant_menu_drafts_on_verify();

commit;
