-- Round-two search fix H26: Search cards show only images cleared for display.
--
-- catalog_raw_publish_release and catalog_raw_refresh_venue copy
-- coalesce(d.image_url, first dish_images.url) into catalog_raw_dish_cards, plus
-- venues.image_url and the top dish's image_url into catalog_raw_venue_cards, with no
-- rights check. The guest-callable page RPCs return those URLs as they are, so Search
-- could show delivery-platform or scraped photos. search_dishes already passes every
-- image through catalog_display_image_url; the raw cards now do the same.
--
-- Rather than restate both large builders, a BEFORE INSERT trigger on each card table
-- re-derives the image from the source rows with catalog_display_image_url (approved,
-- rights status, not Unsplash, not a delivery app unless licensed). An image that does
-- not pass is stored as null. Rows already published are rewritten once below.
--
-- New functions only: app_private.catalog_raw_dish_card_display_image() and
-- app_private.catalog_raw_venue_card_display_images(). Trigger names sort after the
-- existing draft triggers, so they see the final representative_dish.

begin;

create schema if not exists app_private;

-- The first image of a dish that may be shown: the dish's own image, then its gallery in order.
create or replace function app_private.catalog_dish_display_image(p_dish_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url)
      from public.dishes d
      where d.id = p_dish_id
    ),
    (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url)
      from public.dish_images di
      where di.dish_id = p_dish_id
        and public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
      order by di.sort_order, di.id
      limit 1
    )
  );
$$;

revoke all on function app_private.catalog_dish_display_image(text) from public, anon, authenticated;

create or replace function app_private.catalog_raw_dish_card_display_image()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.image_url := app_private.catalog_dish_display_image(new.id);
  return new;
end;
$$;

revoke all on function app_private.catalog_raw_dish_card_display_image() from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_dish_display_images on public.catalog_raw_dish_cards;
create trigger trg_catalog_raw_dish_display_images
before insert on public.catalog_raw_dish_cards
for each row
execute function app_private.catalog_raw_dish_card_display_image();

create or replace function app_private.catalog_raw_venue_card_display_images()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.image_url := (
    select public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
    from public.venues v
    where v.id = new.id
  );
  if new.representative_dish is not null and new.representative_dish ? 'id' then
    new.representative_dish := jsonb_set(
      new.representative_dish,
      '{image_url}',
      coalesce(to_jsonb(app_private.catalog_dish_display_image(new.representative_dish ->> 'id')), 'null'::jsonb)
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.catalog_raw_venue_card_display_images() from public, anon, authenticated;

-- Fires after trg_catalog_raw_venue_card_without_drafts (triggers run in name order).
drop trigger if exists trg_catalog_raw_venue_display_images on public.catalog_raw_venue_cards;
create trigger trg_catalog_raw_venue_display_images
before insert on public.catalog_raw_venue_cards
for each row
execute function app_private.catalog_raw_venue_card_display_images();

-- Rewrite the cards already published.
update public.catalog_raw_dish_cards c
set image_url = app_private.catalog_dish_display_image(c.id)
where c.image_url is not null
  and c.image_url is distinct from app_private.catalog_dish_display_image(c.id);

update public.catalog_raw_venue_cards c
set image_url = (
  select public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
  from public.venues v
  where v.id = c.id
)
where c.image_url is not null;

update public.catalog_raw_venue_cards c
set representative_dish = jsonb_set(
  c.representative_dish,
  '{image_url}',
  coalesce(to_jsonb(app_private.catalog_dish_display_image(c.representative_dish ->> 'id')), 'null'::jsonb)
)
where c.representative_dish is not null
  and c.representative_dish ? 'id'
  and nullif(c.representative_dish ->> 'image_url', '') is not null;

commit;
