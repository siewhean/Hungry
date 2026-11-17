#!/usr/bin/env python3
"""
scripts/test_raw_catalog_holds_isolated.py

Tests the raw catalogue publication hold migration against an isolated local PostgreSQL container:
- Verifies:
  1. Held items (whole_item hold) are completely absent from consumer RPCs (dishes_page, venue_menu_page, dish_detail) and venue aggregates.
  2. Approved items with disputed prices (price_only hold) are visible but return a blank (NULL) price, failing budget filters.
  3. Fully approved items (approved control) remain visible with price, media, and description.
  4. Items with unapproved media have image_url suppressed (NULL) and no child media in catalog_raw_dish_media.
"""

import atexit
import json
import subprocess
import time


CONTAINER = subprocess.check_output(
    ["docker", "run", "--rm", "--detach", "--network", "none",
     "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17", "-c", "listen_addresses="],
    text=True,
).strip()
atexit.register(
    subprocess.run, ["docker", "stop", CONTAINER], stdout=subprocess.DEVNULL, check=True
)

for _ in range(60):
    # Wait for the final server, rather than the bootstrap server which also accepts socket connections.
    ready = subprocess.run(
        ["docker", "exec", CONTAINER, "sh", "-c", "test \"$(cat /proc/1/comm)\" = postgres && pg_isready -U postgres"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    if ready.returncode == 0:
        break
    time.sleep(1)
else:
    raise RuntimeError("Disposable PostgreSQL container did not become ready.")

def run_psql(sql: str) -> str:
    res = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-X", "-A", "-t",
         "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-c", sql],
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        raise RuntimeError(f"psql failed: {res.stderr}")
    return res.stdout.strip()


def assert_rpc_error(sql: str, code: str, message: str):
    try:
        run_psql(sql)
    except RuntimeError as error:
        assert f"{code}: {message}" in str(error), str(error)
    else:
        raise AssertionError(f"Expected {code}: {message}")


print("1. Setting up schema and extensions...")
setup_sql = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'authenticated'::text
$$;

-- Spatial mock functions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geography') THEN
    CREATE DOMAIN public.geography AS text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.st_makepoint(double precision, double precision) RETURNS point LANGUAGE sql IMMUTABLE AS $$
  SELECT point($1, $2)
$$;

CREATE OR REPLACE FUNCTION public.st_setsrid(point, integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT $1::text
$$;

CREATE OR REPLACE FUNCTION public.st_distance(geography, geography) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 0::double precision
$$;

CREATE OR REPLACE FUNCTION public.st_dwithin(geography, geography, integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT true
$$;

-- Domain tables
CREATE TABLE IF NOT EXISTS buildings (
  id text PRIMARY KEY,
  name text,
  building_type text,
  latitude double precision,
  longitude double precision,
  location geography,
  address text,
  postal_code text,
  is_closed_today boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS venues (
  id text PRIMARY KEY,
  building_id text REFERENCES buildings(id),
  name text,
  unit_number text DEFAULT '',
  floor text DEFAULT '',
  address text,
  postal_code text,
  operating_hours text,
  image_url text,
  latitude double precision,
  longitude double precision,
  location geography,
  is_open boolean DEFAULT true,
  cuisine_tags text[] DEFAULT '{}',
  dietary_tags text[] DEFAULT '{}',
  source_confidence numeric DEFAULT 1.0,
  media_approved_for_display boolean DEFAULT true,
  media_rights_status text DEFAULT 'licensed',
  media_source_url text,
  menu_approved_for_display boolean DEFAULT true,
  menu_rights_status text DEFAULT 'licensed',
  menu_source_url text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dishes (
  id text PRIMARY KEY,
  venue_id text REFERENCES venues(id),
  building_id text REFERENCES buildings(id),
  name text NOT NULL,
  description text,
  price numeric,
  price_range text,
  image_url text,
  distance_meters integer DEFAULT 0,
  rating_avg numeric DEFAULT 4.5,
  review_count integer DEFAULT 10,
  cuisine_tags text[] DEFAULT '{}',
  source_confidence numeric DEFAULT 1.0,
  is_open boolean DEFAULT true,
  media_approved_for_display boolean DEFAULT true,
  media_rights_status text DEFAULT 'licensed',
  media_source_url text,
  menu_approved_for_display boolean DEFAULT true,
  menu_rights_status text DEFAULT 'licensed',
  menu_source_url text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dish_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id text REFERENCES dishes(id),
  url text,
  media_source_url text,
  media_rights_status text DEFAULT 'licensed',
  media_approved_for_display boolean DEFAULT true,
  sort_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dietary_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS dish_dietary_flags (
  dish_id text REFERENCES dishes(id),
  dietary_flag_id uuid REFERENCES dietary_flags(id),
  PRIMARY KEY (dish_id, dietary_flag_id)
);

-- Catalog release tables
CREATE TABLE IF NOT EXISTS catalog_releases (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  venue_total integer,
  dish_total integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz
);

CREATE UNIQUE INDEX catalog_releases_one_active_idx
  ON public.catalog_releases ((status = 'active')) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS catalog_raw_venue_cards (
  release_id uuid NOT NULL REFERENCES catalog_releases(id) ON DELETE CASCADE,
  id text NOT NULL,
  building_id text,
  name text,
  building_name text,
  building_type text,
  unit_number text,
  floor text,
  address text,
  postal_code text,
  operating_hours text,
  image_url text,
  latitude double precision,
  longitude double precision,
  listing_location geography,
  is_open boolean,
  menu_count integer,
  cuisine_tags text[],
  dietary_flags text[],
  min_price numeric,
  quality_rating numeric,
  quality_review_count integer,
  representative_dish jsonb,
  verification_status text,
  menu_rights_status text,
  media_rights_status text,
  menu_source_url text,
  media_source_url text,
  updated_at timestamptz,
  PRIMARY KEY (release_id, id)
);

CREATE TABLE IF NOT EXISTS catalog_raw_dish_cards (
  release_id uuid NOT NULL REFERENCES catalog_releases(id) ON DELETE CASCADE,
  id text NOT NULL,
  venue_id text NOT NULL,
  building_id text,
  name text NOT NULL,
  venue_name text,
  building_name text,
  building_type text,
  description text,
  price numeric,
  price_range text,
  image_url text,
  distance_meters integer,
  rating numeric,
  review_count integer,
  cuisine_tags text[],
  dietary_flags text[],
  is_open boolean,
  listing_location geography,
  verification_status text,
  menu_rights_status text,
  media_rights_status text,
  menu_source_url text,
  media_source_url text,
  updated_at timestamptz,
  PRIMARY KEY (release_id, id)
);

CREATE TABLE IF NOT EXISTS catalog_raw_dish_media (
  release_id uuid NOT NULL REFERENCES catalog_releases(id) ON DELETE CASCADE,
  dish_id text NOT NULL,
  media_key text NOT NULL,
  url text,
  source_url text,
  rights_status text,
  approved_for_display boolean,
  sort_order integer,
  PRIMARY KEY (release_id, dish_id, media_key)
);
"""
run_psql(setup_sql)
print("Base schema created.")

# Helper functions from migration 20260713120000
helper_sql = """
CREATE OR REPLACE FUNCTION public.catalog_raw_require_authenticated()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_release_for_read(p_release_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_release_id uuid;
BEGIN
  SELECT id INTO v_release_id
  FROM public.catalog_releases
  WHERE (p_release_id IS NULL AND status = 'active')
     OR (p_release_id IS NOT NULL AND id = p_release_id AND (status = 'active' OR (status = 'retired' AND expires_at > now())))
  ORDER BY activated_at DESC NULLS LAST
  LIMIT 1;
  IF v_release_id IS NULL THEN
    RAISE EXCEPTION 'catalog release unavailable' USING errcode = 'P0001';
  END IF;
  RETURN v_release_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_cursor(p_value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(convert_to(p_value::text, 'utf-8'), 'base64');
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_cursor_value(p_cursor text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(decode(p_cursor, 'base64'), 'utf-8')::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_dish_detail(p_dish_id text, p_release_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release uuid;
  v_result jsonb;
BEGIN
  PERFORM public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  SELECT to_jsonb(c) - 'listing_location' || jsonb_build_object(
    'media', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'url', m.url, 'source_url', m.source_url, 'rights_status', m.rights_status,
        'approved_for_display', m.approved_for_display, 'sort_order', m.sort_order
      ) ORDER BY m.sort_order)
      FROM public.catalog_raw_dish_media m
      WHERE m.release_id = v_release AND m.dish_id = c.id),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM public.catalog_raw_dish_cards c
  WHERE c.release_id = v_release AND c.id = p_dish_id;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'catalog dish not found' USING errcode = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_dishes_page(
  p_query text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL,
  p_radius_meters integer DEFAULT NULL, p_cuisine_tags text[] DEFAULT '{}', p_dietary_flags text[] DEFAULT '{}',
  p_max_price numeric DEFAULT NULL, p_open_only boolean DEFAULT FALSE, p_sort text DEFAULT 'quality',
  p_cursor text DEFAULT NULL, p_release_id uuid DEFAULT NULL, p_limit integer DEFAULT 24, p_venue_id text DEFAULT NULL,
  p_building_types text[] DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb; v_fingerprint text; v_cursor jsonb;
BEGIN
  PERFORM public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);

  v_fingerprint := md5(concat_ws('|', coalesce(lower(trim(p_query)), ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and ((v_cursor->>'release_id')::uuid <> v_release or v_cursor->>'fingerprint' <> v_fingerprint) then
    raise exception 'catalog cursor query mismatch' using errcode = '22023';
  end if;

  WITH candidates AS (
    SELECT c.*
    FROM public.catalog_raw_dish_cards c
    WHERE c.release_id = v_release
      AND (p_venue_id IS NULL OR c.venue_id = p_venue_id)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 OR c.cuisine_tags && p_cuisine_tags)
      AND (cardinality(coalesce(p_dietary_flags, '{}')) = 0 OR c.dietary_flags && p_dietary_flags)
      AND (nullif(trim(coalesce(p_query, '')), '') IS NULL OR c.name ILIKE '%' || p_query || '%')
    ORDER BY c.id
    LIMIT v_limit
  )
  SELECT coalesce(jsonb_agg(to_jsonb(candidates) - 'listing_location'), '[]'::jsonb)
  INTO v_items
  FROM candidates;

  RETURN jsonb_build_object('items', v_items, 'release_id', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_venues_page(
  p_query text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL,
  p_radius_meters integer DEFAULT NULL, p_cuisine_tags text[] DEFAULT '{}', p_dietary_flags text[] DEFAULT '{}',
  p_max_price numeric DEFAULT NULL, p_open_only boolean DEFAULT FALSE, p_sort text DEFAULT 'quality',
  p_cursor text DEFAULT NULL, p_release_id uuid DEFAULT NULL, p_limit integer DEFAULT 24,
  p_building_types text[] DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb;
BEGIN
  PERFORM public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);

  WITH candidates AS (
    SELECT c.*
    FROM public.catalog_raw_venue_cards c
    WHERE c.release_id = v_release
      AND (p_max_price IS NULL OR c.min_price <= p_max_price)
      AND (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 OR c.cuisine_tags && p_cuisine_tags)
      AND (cardinality(coalesce(p_dietary_flags, '{}')) = 0 OR c.dietary_flags && p_dietary_flags)
      AND (nullif(trim(coalesce(p_query, '')), '') IS NULL OR c.name ILIKE '%' || p_query || '%')
    ORDER BY c.id
    LIMIT v_limit
  )
  SELECT coalesce(jsonb_agg(to_jsonb(candidates) - 'listing_location'), '[]'::jsonb)
  INTO v_items
  FROM candidates;

  RETURN jsonb_build_object('items', v_items, 'release_id', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_raw_venue_menu_page(
  p_query text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL,
  p_radius_meters integer DEFAULT NULL, p_cuisine_tags text[] DEFAULT '{}', p_dietary_flags text[] DEFAULT '{}',
  p_max_price numeric DEFAULT NULL, p_open_only boolean DEFAULT FALSE, p_sort text DEFAULT 'quality',
  p_cursor text DEFAULT NULL, p_release_id uuid DEFAULT NULL, p_limit integer DEFAULT 24, p_venue_id text DEFAULT NULL,
  p_building_types text[] DEFAULT '{}'
)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.catalog_raw_dishes_page(p_query, p_lat, p_lng, p_radius_meters, p_cuisine_tags, p_dietary_flags, p_max_price, p_open_only, p_sort, p_cursor, p_release_id, p_limit, p_venue_id, p_building_types);
$$;
"""
run_psql(helper_sql)
print("Helper functions and RPCs loaded.")

print("2. Applying publication holds migration...")
with open("supabase/migrations/20261110150000_raw_catalog_publication_hold_guards.sql") as f:
    migration_sql = f.read()

run_psql(migration_sql)
print("Publication hold migration applied successfully.")

print("3. Seeding test fixtures...")
seed_sql = """
DELETE FROM public.dish_dietary_flags;
DELETE FROM public.dietary_flags;
DELETE FROM public.dish_images;
DELETE FROM public.catalog_item_publication_holds;
DELETE FROM public.dishes;
DELETE FROM public.venues;
DELETE FROM public.buildings;
DELETE FROM public.catalog_releases;

INSERT INTO public.buildings (id, name, building_type, latitude, longitude, location, address, postal_code)
VALUES ('b_test_01', 'Test Plaza', 'mall', 1.3000, 103.8500, '0101000020E61000000000000000F859400000000000CCF43F'::geography, '100 Test Road', '123456');

INSERT INTO public.venues (id, building_id, name, unit_number, address, postal_code, is_open)
VALUES
  ('v_test_01', 'b_test_01', 'Test Gourmet Eatery', '#01-01', '100 Test Road #01-01', '123456', true),
  ('v_test_02', 'b_test_01', 'Halal Corner Cafe', '#01-02', '100 Test Road #01-02', '123456', true);

INSERT INTO public.dietary_flags (id, slug)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'halal'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'vegetarian');

-- Dish 1: Approved control (approved, $15.50, verified photo)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_approved_control', 'v_test_01', 'b_test_01', 'Signature Wagyu Bowl', 'Authentic wagyu beef over rice', 15.50, 'https://images.usehungry.com/wagyu.jpg', true, true, 4.8);

-- Dish 2: Whole-item hold via table (unverified outlet / explicit hold)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_whole_item_hold', 'v_test_01', 'b_test_01', 'Disputed Seafood Platter', 'Unverified outlet item', 38.00, 'https://images.usehungry.com/seafood.jpg', false, false, 4.0);

INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('d_whole_item_hold', 'whole_item', 'Cross-stall misattribution pending authentic menu', 'https://evidence.example.com/hold1');

-- Dish 3: Whole-item hold via description marker (e.g. legacy hold note)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_desc_held_note', 'v_test_01', 'b_test_01', 'Stale Draft Pasta', 'Menu item and price not independently verified; do not publish as a confirmed outlet menu', 22.00, 'https://images.usehungry.com/pasta.jpg', false, false, 3.5);

-- Dish 4: Price-only hold (approved item, but disputed price)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_price_only_hold', 'v_test_01', 'b_test_01', 'Seasonal Chicken Rice', 'Authentic chicken rice, price under review', 6.50, 'https://images.usehungry.com/chicken.jpg', true, true, 4.5);

INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('d_price_only_hold', 'price_only', 'Disputed aggregator starting price; awaiting physical menu', 'https://evidence.example.com/pricehold');

-- Dish 5: Unapproved media (approved item, but unapproved image)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_unapproved_media', 'v_test_01', 'b_test_01', 'Handmade Gyoza', '6 pieces pan-fried gyoza', 8.00, 'https://images.usehungry.com/unapproved.jpg', true, false, 4.2);

INSERT INTO public.dish_images (dish_id, url, media_approved_for_display)
VALUES ('d_unapproved_media', 'https://images.usehungry.com/unapproved_child.jpg', false);

-- Dish 6: Dietary-only hold (has halal flag in dish_dietary_flags, but held via catalog_item_publication_holds)
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_dietary_hold', 'v_test_01', 'b_test_01', 'Pork Ribs with Disputed Halal Claim', 'Contradictory pork item incorrectly tagged as Halal', 14.00, 'https://images.usehungry.com/pork.jpg', true, true, 4.0);

INSERT INTO public.dish_dietary_flags (dish_id, dietary_flag_id)
VALUES ('d_dietary_hold', '10000000-0000-0000-0000-000000000001'::uuid);

INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('d_dietary_hold', 'dietary_only', 'Disputed Halal certification contradicted by pork text', 'https://evidence.example.com/dietaryhold');

-- The dietary and media holds coexist on one item and must leave its price visible.
INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason)
VALUES ('d_dietary_hold', 'media_only', 'Photo rights under review');
INSERT INTO public.dish_images (dish_id, url, media_approved_for_display)
VALUES ('d_dietary_hold', 'https://images.usehungry.com/pork_child.jpg', true);
UPDATE public.dishes SET price_range = 'S$6.50–S$9.00' WHERE id = 'd_price_only_hold';

-- Dish 7: Approved Halal Control in venue v_test_02
INSERT INTO public.dishes (id, venue_id, building_id, name, description, price, image_url, menu_approved_for_display, media_approved_for_display, rating_avg)
VALUES ('d_approved_halal', 'v_test_02', 'b_test_01', 'Certified Chicken Briyani', 'Authentic certified briyani', 9.50, 'https://images.usehungry.com/briyani.jpg', true, true, 4.7);

INSERT INTO public.dish_dietary_flags (dish_id, dietary_flag_id)
VALUES ('d_approved_halal', '10000000-0000-0000-0000-000000000001'::uuid);
"""
run_psql(seed_sql)
print("Seed fixtures populated.")

print("4. Executing catalog_raw_publish_release()...")
release_id = run_psql("SELECT public.catalog_raw_publish_release();")
print(f"Published release ID: {release_id}")

print("5. Running assertions...")

# Check 1: catalog_raw_dish_cards
cards_res = run_psql(f"SELECT id, price, image_url FROM public.catalog_raw_dish_cards WHERE release_id = '{release_id}' ORDER BY id;")
print("Published Dish Cards:\n", cards_res)

dish_map = {}
for line in cards_res.strip().split("\n"):
    if line:
        parts = line.split("|")
        dish_map[parts[0]] = {"price": parts[1], "image_url": parts[2]}

# Assertion 1: Whole-item holds are completely absent
assert "d_whole_item_hold" not in dish_map, "FAILURE: d_whole_item_hold must NOT be in dish cards!"
assert "d_desc_held_note" not in dish_map, "FAILURE: d_desc_held_note must NOT be in dish cards!"
print("✔ Assertion 1 Passed: Whole-item holds (d_whole_item_hold & d_desc_held_note) are completely absent from dish cards.")

# Assertion 2: Approved item with disputed price returns NULL price
assert "d_price_only_hold" in dish_map, "FAILURE: d_price_only_hold must be present in dish cards!"
assert dish_map["d_price_only_hold"]["price"] == "", f"FAILURE: d_price_only_hold price must be NULL, got '{dish_map['d_price_only_hold']['price']}'!"
print("✔ Assertion 2 Passed: Approved item with disputed price (d_price_only_hold) is present with NULL price.")

# Assertion 3: Fully approved control is present with price and image
assert "d_approved_control" in dish_map, "FAILURE: d_approved_control must be present!"
assert float(dish_map["d_approved_control"]["price"]) == 15.50, f"FAILURE: Expected 15.50, got {dish_map['d_approved_control']['price']}"
assert dish_map["d_approved_control"]["image_url"] == "https://images.usehungry.com/wagyu.jpg"
print("✔ Assertion 3 Passed: Fully approved item (d_approved_control) is present with price=15.50 and valid image_url.")

# Assertion 4: Unapproved media has image_url suppressed
assert "d_unapproved_media" in dish_map, "FAILURE: d_unapproved_media must be present!"
assert dish_map["d_unapproved_media"]["image_url"] == "", f"FAILURE: image_url must be NULL, got {dish_map['d_unapproved_media']['image_url']}"
media_count = int(run_psql(f"SELECT count(*) FROM public.catalog_raw_dish_media WHERE release_id = '{release_id}' AND dish_id = 'd_unapproved_media';"))
assert media_count == 0, f"FAILURE: Expected 0 child media entries for unapproved media, got {media_count}"
print("✔ Assertion 4 Passed: Unapproved media suppressed (image_url=NULL and 0 child media entries).")

# Check 2: Consumer RPC catalog_raw_dishes_page budget filter
print("Testing consumer RPC: catalog_raw_dishes_page...")
page_all = json.loads(run_psql(f"SELECT public.catalog_raw_dishes_page(p_release_id => '{release_id}'::uuid);"))
page_all_ids = [item["id"] for item in page_all["items"]]
print("All visible items in page RPC:", page_all_ids)
assert "d_whole_item_hold" not in page_all_ids
assert "d_desc_held_note" not in page_all_ids
assert "d_approved_control" in page_all_ids
assert "d_price_only_hold" in page_all_ids
assert "d_unapproved_media" in page_all_ids
assert "d_dietary_hold" in page_all_ids
assert "d_approved_halal" in page_all_ids
print("✔ Assertion 5 Passed: Consumer RPC catalog_raw_dishes_page returns only permissible items.")

# Budget filter check (p_max_price => 20.00)
page_budget = json.loads(run_psql(f"SELECT public.catalog_raw_dishes_page(p_max_price => 20.00, p_release_id => '{release_id}'::uuid);"))
page_budget_ids = [item["id"] for item in page_budget["items"]]
print("Budget-filtered items (<= $20.00):", page_budget_ids)
assert "d_approved_control" in page_budget_ids, "d_approved_control ($15.50) must match budget"
assert "d_unapproved_media" in page_budget_ids, "d_unapproved_media ($8.00) must match budget"
assert "d_dietary_hold" in page_budget_ids, "d_dietary_hold ($14.00) must match budget"
assert "d_approved_halal" in page_budget_ids, "d_approved_halal ($9.50) must match budget"
assert "d_price_only_hold" not in page_budget_ids, "FAILURE: d_price_only_hold (null price) must NOT match numeric budget filter!"
print("✔ Assertion 6 Passed: Price-only hold (null price) fails closed on budget filter (p_max_price).")

# Check 3: Venue menu page & Venue card aggregates
print("Testing venue menu page and venue card aggregates...")
venue_menu = json.loads(run_psql(f"SELECT public.catalog_raw_venue_menu_page(p_venue_id => 'v_test_01', p_release_id => '{release_id}'::uuid);"))
venue_menu_ids = [item["id"] for item in venue_menu["items"]]
print("Venue menu items for v_test_01:", venue_menu_ids)
assert "d_whole_item_hold" not in venue_menu_ids
assert "d_desc_held_note" not in venue_menu_ids
assert len(venue_menu_ids) == 4

venue_card = json.loads(run_psql(f"SELECT row_to_json(v) FROM (SELECT menu_count, min_price, representative_dish, dietary_flags FROM public.catalog_raw_venue_cards WHERE release_id = '{release_id}' AND id = 'v_test_01') v;"))
print("Venue card aggregates for v_test_01:", venue_card)
assert venue_card["menu_count"] == 4, f"Expected menu_count=4, got {venue_card['menu_count']}"
assert float(venue_card["min_price"]) == 8.00, f"Expected min_price=8.00, got {venue_card['min_price']}"
assert venue_card["representative_dish"]["id"] != "d_whole_item_hold"
print("✔ Assertion 7 Passed: Venue card menu_count=4, min_price=8.00 (excludes whole-item and price-only holds), representative dish is valid.")

# Check 4: Detail RPC
print("Testing detail RPC: catalog_raw_dish_detail...")
assert_rpc_error(
    f"SELECT public.catalog_raw_dish_detail('d_whole_item_hold', '{release_id}'::uuid);",
    "P0002", "catalog dish not found",
)
print("✔ Assertion 8 Passed: catalog_raw_dish_detail raises exception for whole-item hold.")

price_hold_detail = json.loads(run_psql(f"SELECT public.catalog_raw_dish_detail('d_price_only_hold', '{release_id}'::uuid);"))
assert price_hold_detail["price"] is None, "Price must be null in detail RPC for price-only hold"
assert price_hold_detail["price_range"] is None, "Disputed price range must also be null"
print("✔ Assertion 9 Passed: catalog_raw_dish_detail returns price=null for price-only hold.")

approved_detail = json.loads(run_psql(f"SELECT public.catalog_raw_dish_detail('d_approved_control', '{release_id}'::uuid);"))
assert float(approved_detail["price"]) == 15.50
print("✔ Assertion 10 Passed: catalog_raw_dish_detail returns price=15.50 for approved control.")

# Check 5: Dietary-only hold verification
print("Testing dietary-only hold enforcement across detail, venue aggregate, and search...")
dietary_hold_detail = json.loads(run_psql(f"SELECT public.catalog_raw_dish_detail('d_dietary_hold', '{release_id}'::uuid);"))
print("d_dietary_hold detail dietary flags:", dietary_hold_detail.get("dietary_flags"))
assert dietary_hold_detail.get("dietary_flags") == [], f"FAILURE: Dietary flags for held dish must be empty [], got {dietary_hold_detail.get('dietary_flags')}"
print("✔ Assertion 11 Passed: Disputed dietary flags are absent (empty []) from dish detail.")

# Venue aggregate dietary flags
assert venue_card["dietary_flags"] == [], f"FAILURE: Venue dietary_flags must not contain held flag, got {venue_card['dietary_flags']}"
venue_card_02 = json.loads(run_psql(f"SELECT row_to_json(v) FROM (SELECT dietary_flags FROM public.catalog_raw_venue_cards WHERE release_id = '{release_id}' AND id = 'v_test_02') v;"))
assert venue_card_02["dietary_flags"] == ["halal"], f"FAILURE: Venue v_test_02 must contain approved halal, got {venue_card_02['dietary_flags']}"
print("✔ Assertion 12 Passed: Disputed dietary flags are absent from venue aggregates, approved venue retains ['halal'].")

# Dietary search via dishes_page
dietary_dishes = json.loads(run_psql(f"SELECT public.catalog_raw_dishes_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{release_id}'::uuid);"))
dietary_dish_ids = [d["id"] for d in dietary_dishes["items"]]
print("Dietary-filtered dish search results:", dietary_dish_ids)
assert "d_approved_halal" in dietary_dish_ids, "Approved halal dish must be returned by halal search"
assert "d_dietary_hold" not in dietary_dish_ids, "FAILURE: Dish with dietary hold must NOT match dietary search!"
print("✔ Assertion 13 Passed: Disputed dietary flags fail dietary search filter; only approved dishes match.")

# Dietary search via venues_page
dietary_venues = json.loads(run_psql(f"SELECT public.catalog_raw_venues_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{release_id}'::uuid);"))
dietary_venue_ids = [v["id"] for v in dietary_venues["items"]]
print("Dietary-filtered venue search results:", dietary_venue_ids)
assert "v_test_02" in dietary_venue_ids, "Approved venue v_test_02 must match halal search"
assert "v_test_01" not in dietary_venue_ids, "FAILURE: Venue v_test_01 with disputed halal must NOT match halal venue search!"
print("✔ Assertion 14 Passed: Venue search with dietary filter excludes venues whose only matching flag was held.")

# Check 6: Older releases and existing cursors
print("Testing older releases, expired releases, and existing cursor protections...")

# 6A: Expired release rejection
r_expired = "99999999-9999-4999-8999-999999999999"
run_psql(f"""
INSERT INTO public.catalog_releases (id, status, venue_total, dish_total, activated_at, expires_at)
VALUES ('{r_expired}'::uuid, 'retired', 1, 1, now() - interval '48 hours', now() - interval '24 hours');
""")
assert_rpc_error(
    f"SELECT public.catalog_raw_dish_detail('d_approved_control', '{r_expired}'::uuid);",
    "P0001", "catalog release unavailable",
)
print("✔ Assertion 15 Passed: Authenticated client passing expired release ID raises 'catalog release unavailable'.")

# 6B: Existing cursor from older/retired release rejected on active release
# Generate a valid cursor for r_expired
cursor_data = json.dumps({"release_id": r_expired, "fingerprint": "d41d8cd98f00b204e9800998ecf8427e", "id": "d_approved_control", "distance": 0, "review_count": 10, "score": 4.8})
cursor_b64 = run_psql(f"SELECT encode('{cursor_data}'::bytea, 'base64');")

assert_rpc_error(
    f"SELECT public.catalog_raw_dishes_page(p_cursor => '{cursor_b64}');",
    "22023", "catalog cursor query mismatch",
)
print("✔ Assertion 16 Passed: Authenticated client using existing cursor from older release cannot query active release ('catalog cursor query mismatch').")

# 6C: Retained older release within grace period has held content scrubbed
# Simulate an older release that held content before a new publication run
r_grace = "88888888-8888-4888-8888-888888888888"
run_psql(f"""
UPDATE public.catalog_releases
SET status = 'retired', expires_at = now() + interval '24 hours'
WHERE id = '{release_id}'::uuid;

INSERT INTO public.catalog_releases (id, status, venue_total, dish_total, activated_at, expires_at)
VALUES ('{r_grace}'::uuid, 'active', 2, 5, now() - interval '2 hours', null);

INSERT INTO public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, building_type, unit_number, floor, address, postal_code,
  operating_hours, image_url, latitude, longitude, listing_location, is_open, menu_count, cuisine_tags,
  dietary_flags, min_price, quality_rating, quality_review_count, representative_dish, verification_status,
  menu_rights_status, media_rights_status, menu_source_url, media_source_url, updated_at
)
VALUES
  ('{r_grace}'::uuid, 'v_test_01', 'b_test_01', 'Test Gourmet Eatery', 'Test Plaza', 'mall', '#01-01', '1', '100 Test Road #01-01', '123456',
   null, null, 1.3000, 103.8500, '0101000020E61000000000000000F859400000000000CCF43F'::geography, true, 4, '{{}}', '{{halal}}', 6.50,
   4.5, 10, '{{"id": "d_whole_item_hold", "name": "Disputed Seafood Platter", "price": 38.00}}'::jsonb, 'raw', null, null, null, null, now());

INSERT INTO public.catalog_raw_dish_cards (release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price, price_range, image_url, cuisine_tags, dietary_flags, is_open)
VALUES
  ('{r_grace}'::uuid, 'd_approved_control', 'v_test_01', 'b_test_01', 'Signature Wagyu Bowl', 'Test Gourmet Eatery', 'Test Plaza', 'mall', 'Authentic wagyu beef over rice', 15.50, 'S$15.50', 'https://images.usehungry.com/wagyu.jpg', '{{}}', '{{}}', true),
  ('{r_grace}'::uuid, 'd_whole_item_hold', 'v_test_01', 'b_test_01', 'Disputed Seafood Platter', 'Test Gourmet Eatery', 'Test Plaza', 'mall', 'Unverified outlet item', 38.00, 'S$38.00', 'https://images.usehungry.com/seafood.jpg', '{{}}', '{{}}', true),
  ('{r_grace}'::uuid, 'd_price_only_hold', 'v_test_01', 'b_test_01', 'Seasonal Chicken Rice', 'Test Gourmet Eatery', 'Test Plaza', 'mall', 'Authentic chicken rice', 6.50, 'S$6.50', 'https://images.usehungry.com/chicken.jpg', '{{}}', '{{}}', true),
  ('{r_grace}'::uuid, 'd_dietary_hold', 'v_test_01', 'b_test_01', 'Pork Ribs with Disputed Halal Claim', 'Test Gourmet Eatery', 'Test Plaza', 'mall', 'Contradictory pork item', 14.00, 'S$14.00', 'https://images.usehungry.com/pork.jpg', '{{}}', '{{halal}}', true);

INSERT INTO public.catalog_raw_dish_media (release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order)
VALUES
  ('{r_grace}'::uuid, 'd_whole_item_hold', 'media_whole', 'https://images.usehungry.com/seafood.jpg', null, 'unverified', false, 0),
  ('{r_grace}'::uuid, 'd_dietary_hold', 'media_child', 'https://images.usehungry.com/pork_child.jpg', null, 'approved', true, 0);
""")

# Now run catalog_raw_publish_release() which will publish release_id_3, retire r_grace (setting expires_at = now() + 24h),
# AND execute step 5 & 6 scrubbing held records from r_grace!
release_id_3 = run_psql("SELECT public.catalog_raw_publish_release();")
print(f"Published new release: {release_id_3}; r_grace ({r_grace}) transitioned to retired.")

# Verify r_grace held item is scrubbed
assert_rpc_error(
    f"SELECT public.catalog_raw_dish_detail('d_whole_item_hold', '{r_grace}'::uuid);",
    "P0002", "catalog dish not found",
)
print("✔ Assertion 17 Passed: Whole-item hold is scrubbed from retained older release; detail raises 'catalog dish not found'.")

# Verify r_grace price-only hold and dietary hold are scrubbed
r_grace_price_detail = json.loads(run_psql(f"SELECT public.catalog_raw_dish_detail('d_price_only_hold', '{r_grace}'::uuid);"))
assert r_grace_price_detail["price"] is None, f"FAILURE: Price in retired release must be scrubbed to null, got {r_grace_price_detail['price']}"
assert r_grace_price_detail["price_range"] is None, "Disputed price range must be scrubbed from the retired release"

r_grace_dietary_detail = json.loads(run_psql(f"SELECT public.catalog_raw_dish_detail('d_dietary_hold', '{r_grace}'::uuid);"))
assert r_grace_dietary_detail["dietary_flags"] == [], f"FAILURE: Dietary flags in retired release must be scrubbed to [], got {r_grace_dietary_detail['dietary_flags']}"
print("✔ Assertion 18 Passed: Disputed price and dietary claims in retained older release are scrubbed (price=null, dietary_flags=[]).")

# 6D: Dish results search RPC on retained release during grace period
r_grace_dishes = json.loads(run_psql(f"SELECT public.catalog_raw_dishes_page(p_release_id => '{r_grace}'::uuid);"))
r_grace_dish_ids = [d["id"] for d in r_grace_dishes["items"]]
print("Retained release dish search items:", r_grace_dish_ids)
assert "d_whole_item_hold" not in r_grace_dish_ids, "d_whole_item_hold must NOT appear in retained release dishes page!"
assert "d_approved_control" in r_grace_dish_ids, "d_approved_control must appear in retained release dishes page!"
r_grace_price_item = next(d for d in r_grace_dishes["items"] if d["id"] == "d_price_only_hold")
assert r_grace_price_item["price"] is None, "Price must be null in dishes page for price-only hold in retained release!"
r_grace_dietary_item = next(d for d in r_grace_dishes["items"] if d["id"] == "d_dietary_hold")
assert r_grace_dietary_item["dietary_flags"] == [], "Dietary flags must be empty in dishes page for dietary hold in retained release!"

# Media suppression in retained release
r_grace_media_count = int(run_psql(f"SELECT count(*) FROM public.catalog_raw_dish_media WHERE release_id = '{r_grace}'::uuid AND dish_id = 'd_whole_item_hold';"))
assert r_grace_media_count == 0, f"Expected 0 media records for held dish in retained release, got {r_grace_media_count}"
print("✔ Assertion 19 Passed: Retained older release dishes page excludes held items, suppresses disputed prices/dietary flags, and purges held media.")

# 6E: Venue summaries on retained release during grace period
r_grace_venue_card = json.loads(run_psql(f"SELECT row_to_json(v) FROM (SELECT menu_count, min_price, dietary_flags, representative_dish FROM public.catalog_raw_venue_cards WHERE release_id = '{r_grace}'::uuid AND id = 'v_test_01') v;"))
print("Retained release venue card summary for v_test_01:", r_grace_venue_card)
assert r_grace_venue_card["menu_count"] == 3, f"Expected menu_count=3 in retained release venue summary, got {r_grace_venue_card['menu_count']}"
assert float(r_grace_venue_card["min_price"]) == 14.00, f"Expected min_price=14.00 in retained release venue summary, got {r_grace_venue_card['min_price']}"
assert r_grace_venue_card["dietary_flags"] == [], f"Expected empty dietary_flags in retained release venue summary, got {r_grace_venue_card['dietary_flags']}"
assert r_grace_venue_card["representative_dish"]["id"] != "d_whole_item_hold", "Representative dish must not be held item in retained release!"

# Venue search RPC on retained release
r_grace_venues = json.loads(run_psql(f"SELECT public.catalog_raw_venues_page(p_release_id => '{r_grace}'::uuid);"))
r_grace_venue_item = next(v for v in r_grace_venues["items"] if v["id"] == "v_test_01")
assert r_grace_venue_item["menu_count"] == 3
assert float(r_grace_venue_item["min_price"]) == 14.00
assert r_grace_venue_item["dietary_flags"] == []

# Dietary filter on retained release venue search
r_grace_halal_venues = json.loads(run_psql(f"SELECT public.catalog_raw_venues_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{r_grace}'::uuid);"))
r_grace_halal_venue_ids = [v["id"] for v in r_grace_halal_venues["items"]]
assert "v_test_01" not in r_grace_halal_venue_ids, "Venue v_test_01 must NOT match halal venue search in retained release!"
print("✔ Assertion 20 Passed: Retained older release venue summaries (menu_count=3, min_price=14.00, dietary_flags=[]) and venue search exclude held items and disputed claims.")

for checked_release in (release_id_3, r_grace):
    held_media = json.loads(run_psql(
        f"SELECT public.catalog_raw_dish_detail('d_dietary_hold', '{checked_release}'::uuid);"
    ))
    assert held_media["image_url"] is None
    assert held_media["media"] == []
    assert float(held_media["price"]) == 14.00
print("✔ Assertion 21 Passed: Combined media and dietary holds preserve price and suppress inline and child images across releases.")

for checked_release in (release_id_3, r_grace):
    budget_menu = json.loads(run_psql(
        "SELECT public.catalog_raw_venue_menu_page(p_venue_id => 'v_test_01', "
        f"p_max_price => 7.00, p_release_id => '{checked_release}'::uuid);"
    ))
    assert budget_menu["items"] == [], "Held SGD 6.50 price must not match a venue menu budget"
    unfiltered_menu = json.loads(run_psql(
        "SELECT public.catalog_raw_venue_menu_page(p_venue_id => 'v_test_01', "
        f"p_release_id => '{checked_release}'::uuid);"
    ))
    price_held = next(item for item in unfiltered_menu["items"] if item["id"] == "d_price_only_hold")
    assert price_held["price"] is None and price_held["price_range"] is None
print("✔ Assertion 22 Passed: The venue menu excludes price-held items from budget matches and blanks price fields without a budget.")

assert_rpc_error(
    f"SELECT public.catalog_raw_dish_detail('d_approved_control', '{release_id}'::uuid);",
    "P0001", "catalog release unavailable",
)
print("✔ Assertion 23 Passed: A prior retired release is revoked when the next release is published.")

print("\n========================================================")
print("ALL 23 ISOLATED DATABASE VERIFICATION ASSERTIONS PASSED!")
print("========================================================")
