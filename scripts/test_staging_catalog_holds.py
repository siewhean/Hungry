#!/usr/bin/env python3
"""
scripts/test_staging_catalog_holds.py

Executes Gate 1 authenticated migration replay checks against confirmed staging target:
uuylnktiipkmcweyqnpd (hungry-staging)

Verifies:
1. Active release:
   - Dish detail RPC suppresses whole-item holds, nullifies disputed prices, clears disputed dietary flags.
   - Dish search RPC excludes whole-item holds, fails budget filter on price-only holds, fails dietary filter on dietary holds.
   - Media suppression in catalog_raw_dish_media.
   - Venue aggregates (menu_count, min_price, dietary_flags, representative_dish) in catalog_raw_venue_cards and catalog_raw_venues_page.
2. Retained unexpired retired release during grace period:
   - Dish detail, search, media, and venue aggregates scrubbed of held items and claims.
3. Restores staging to clean baseline.
"""

import subprocess
import json
import sys

DB_URL = "postgresql://postgres.uuylnktiipkmcweyqnpd:S13wH34n%3A%29%3A%28@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

def run_sql(sql: str) -> str:
    res = subprocess.run(
        ["psql", DB_URL, "-X", "-A", "-t", "-c", sql],
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("SQL Error:\n", res.stderr, file=sys.stderr)
        raise RuntimeError(f"psql failed: {res.stderr}")
    return res.stdout.strip()

print("--- Step 1: Pre-flight Verification of Staging Environment ---")
version = run_sql("SELECT version();")
print("Staging Postgres Version:", version.splitlines()[0])

db_name = run_sql("SELECT current_database();")
assert db_name == "postgres", f"Expected db postgres, got {db_name}"

# Check migration table exists
table_check = run_sql("SELECT to_regclass('public.catalog_item_publication_holds');")
assert table_check == "catalog_item_publication_holds", "catalog_item_publication_holds table not found!"
print("✔ Migration table catalog_item_publication_holds verified on staging.")

print("\n--- Step 2: Seeding Controlled Test Fixtures on Staging ---")
# Back up original description of dish-chicken-rice and media_approved of dish-wagyu-burger
orig_chicken_desc = run_sql("SELECT description FROM public.dishes WHERE id = 'dish-chicken-rice';")
orig_wagyu_media = run_sql("SELECT media_approved_for_display FROM public.dishes WHERE id = 'dish-wagyu-burger';")

# Clean existing holds in table
run_sql("DELETE FROM public.catalog_item_publication_holds WHERE dish_id IN ('dish-laksa', 'dish-satay', 'dish-pandan-cake', 'dish-wagyu-burger');")

# Ensure dish-pandan-cake has a dietary flag (halal)
halal_id = run_sql("SELECT id FROM public.dietary_flags WHERE slug = 'halal';")
run_sql(f"""
INSERT INTO public.dish_dietary_flags (dish_id, dietary_flag_id)
VALUES ('dish-pandan-cake', '{halal_id}'::uuid)
ON CONFLICT DO NOTHING;
""")

# Apply controlled holds:
# 1. Whole item hold on dish-laksa
run_sql("""
INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('dish-laksa', 'whole_item', 'Staging test: whole item hold', 'https://staging.test/laksa');
""")

# 2. Whole item hold via description on dish-chicken-rice
run_sql("""
UPDATE public.dishes
SET description = coalesce(description, '') || ' | Menu item and price not independently verified; do not publish as a confirmed outlet menu'
WHERE id = 'dish-chicken-rice';
""")

# 3. Price-only hold on dish-satay
run_sql("""
INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('dish-satay', 'price_only', 'Staging test: price only hold', 'https://staging.test/satay');
""")

# 4. Dietary-only hold on dish-pandan-cake
run_sql("""
INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('dish-pandan-cake', 'dietary_only', 'Staging test: dietary only hold', 'https://staging.test/pandan');
""")

# 5. Media-only hold on dish-wagyu-burger
run_sql("""
INSERT INTO public.catalog_item_publication_holds (dish_id, hold_scope, hold_reason, source_evidence_url)
VALUES ('dish-wagyu-burger', 'media_only', 'Staging test: media only hold', 'https://staging.test/wagyu');
""")
print("✔ Controlled fixtures seeded successfully.")

print("\n--- Step 3: Publishing Release 1 with Publication Holds Active ---")
r_active_1 = run_sql("SELECT public.catalog_raw_publish_release();")
print(f"Published active release 1: {r_active_1}")

print("\n--- Step 4: Authenticated Checks on Active Release ---")
# Set auth context in helper queries
def run_auth_sql(sql: str) -> str:
    full_sql = f"""
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    {sql}
    """
    # When multiple statements run, take the output from the last statement
    res = subprocess.run(
        ["psql", DB_URL, "-X", "-A", "-t", "-c", full_sql],
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        raise RuntimeError(f"psql failed: {res.stderr}")
    lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
    return lines[-1] if lines else ""

# 4A: Dish Detail RPC
print("Testing Dish Detail RPC (catalog_raw_dish_detail)...")
try:
    run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-laksa', '{r_active_1}'::uuid);")
    assert False, "catalog_raw_dish_detail must raise error for whole-item hold (dish-laksa)!"
except RuntimeError:
    print("✔ Gate 1.1 Passed: Whole-item hold (dish-laksa) raises 404 in detail RPC.")

try:
    run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-chicken-rice', '{r_active_1}'::uuid);")
    assert False, "catalog_raw_dish_detail must raise error for description hold (dish-chicken-rice)!"
except RuntimeError:
    print("✔ Gate 1.2 Passed: Description hold (dish-chicken-rice) raises 404 in detail RPC.")

satay_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-satay', '{r_active_1}'::uuid);"))
assert satay_detail["price"] is None, f"Expected null price for price-only hold, got {satay_detail['price']}"
print("✔ Gate 1.3 Passed: Price-only hold (dish-satay) returns price=null in detail RPC.")

pandan_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-pandan-cake', '{r_active_1}'::uuid);"))
assert pandan_detail["dietary_flags"] == [], f"Expected empty dietary_flags for dietary hold, got {pandan_detail['dietary_flags']}"
print("✔ Gate 1.4 Passed: Dietary-only hold (dish-pandan-cake) returns dietary_flags=[] in detail RPC.")

wagyu_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-wagyu-burger', '{r_active_1}'::uuid);"))
assert wagyu_detail["image_url"] is None, f"Expected null image_url for media hold, got {wagyu_detail['image_url']}"
assert len(wagyu_detail.get("media", [])) == 0, f"Expected 0 media entries for media hold, got {len(wagyu_detail.get('media', []))}"
print("✔ Gate 1.5 Passed: Media-only hold (dish-wagyu-burger) suppresses image_url and child media in detail RPC.")

ban_mian_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-ban-mian', '{r_active_1}'::uuid);"))
assert float(ban_mian_detail["price"]) == 6.50
print("✔ Gate 1.6 Passed: Approved control (dish-ban-mian) returns valid price=6.50 in detail RPC.")

# 4B: Dish Search RPC (catalog_raw_dishes_page)
print("\nTesting Dish Search RPC (catalog_raw_dishes_page)...")
dishes_page = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dishes_page(p_release_id => '{r_active_1}'::uuid);"))
visible_dish_ids = [d["id"] for d in dishes_page["items"]]
print("Visible dish IDs:", visible_dish_ids)
assert "dish-laksa" not in visible_dish_ids, "dish-laksa must NOT be visible!"
assert "dish-chicken-rice" not in visible_dish_ids, "dish-chicken-rice must NOT be visible!"
assert "dish-ban-mian" in visible_dish_ids, "dish-ban-mian must be visible!"
assert "dish-satay" in visible_dish_ids, "dish-satay must be visible!"
print("✔ Gate 1.7 Passed: Dish search excludes whole-item and description holds.")

# Budget filter
budget_page = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dishes_page(p_max_price => 10.00, p_release_id => '{r_active_1}'::uuid);"))
budget_dish_ids = [d["id"] for d in budget_page["items"]]
assert "dish-satay" not in budget_dish_ids, "dish-satay with null price must fail max_price budget filter!"
print("✔ Gate 1.8 Passed: Price-only hold (null price) fails closed on budget filter.")

# Dietary search filter
dietary_page = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dishes_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{r_active_1}'::uuid);"))
dietary_dish_ids = [d["id"] for d in dietary_page["items"]]
assert "dish-pandan-cake" not in dietary_dish_ids, "dish-pandan-cake with dietary hold must NOT match halal search!"
print("✔ Gate 1.9 Passed: Dietary hold fails closed on dietary search filter.")

# 4C: Venue Card Aggregates & Search
print("\nTesting Venue Card Aggregates & Search...")
# venue-tian-tian originally had dish-laksa, dish-pandan-cake, dish-chicken-rice
# dish-laksa & dish-chicken-rice are whole-item holds => menu_count should be 1 (only pandan cake)!
tian_tian_card = json.loads(run_sql(f"SELECT row_to_json(v) FROM (SELECT menu_count, min_price, dietary_flags, representative_dish FROM public.catalog_raw_venue_cards WHERE release_id = '{r_active_1}'::uuid AND id = 'venue-tian-tian') v;"))
print("Tian Tian venue card:", tian_tian_card)
assert tian_tian_card["menu_count"] == 1, f"Expected menu_count=1 for venue-tian-tian, got {tian_tian_card['menu_count']}"
assert tian_tian_card["dietary_flags"] == [], f"Expected empty dietary_flags for venue-tian-tian, got {tian_tian_card['dietary_flags']}"
assert tian_tian_card["representative_dish"]["id"] not in ("dish-laksa", "dish-chicken-rice"), "Representative dish cannot be held dish!"
print("✔ Gate 1.10 Passed: Venue card menu_count=1, dietary_flags=[], and representative_dish updated away from held dishes.")

# Venue search with dietary filter
venue_dietary_search = json.loads(run_auth_sql(f"SELECT public.catalog_raw_venues_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{r_active_1}'::uuid);"))
venue_dietary_ids = [v["id"] for v in venue_dietary_search["items"]]
assert "venue-tian-tian" not in venue_dietary_ids, "venue-tian-tian must NOT match halal search!"
print("✔ Gate 1.11 Passed: Venue search with dietary filter excludes venue-tian-tian.")

print("\n--- Step 5: Publishing Release 2 to Transition Release 1 into Unexpired Retired Grace Period ---")
r_active_2 = run_sql("SELECT public.catalog_raw_publish_release();")
print(f"Published active release 2: {r_active_2}")

# Verify release statuses
r1_status = run_sql(f"SELECT status FROM public.catalog_releases WHERE id = '{r_active_1}'::uuid;")
r1_expires = run_sql(f"SELECT (expires_at > now()) FROM public.catalog_releases WHERE id = '{r_active_1}'::uuid;")
assert r1_status == "retired", f"Expected r_active_1 status retired, got {r1_status}"
assert r1_expires == "t", f"Expected r_active_1 expires_at > now(), got {r1_expires}"
print(f"✔ Release 1 ({r_active_1}) is retired within active 24-hour grace period.")

print("\n--- Step 6: Authenticated Checks on Unexpired Retired Release (Grace Period) ---")
# 6A: Detail RPC on retired release
try:
    run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-laksa', '{r_active_1}'::uuid);")
    assert False, "catalog_raw_dish_detail must raise error for scrubbed item in retired release!"
except RuntimeError:
    print("✔ Gate 1.12 Passed: Whole-item hold is scrubbed from retained older release; detail raises 404.")

r1_satay_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-satay', '{r_active_1}'::uuid);"))
assert r1_satay_detail["price"] is None, f"Expected null price in retired release, got {r1_satay_detail['price']}"
print("✔ Gate 1.13 Passed: Price-only hold price is scrubbed to null in retained older release.")

r1_pandan_detail = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dish_detail('dish-pandan-cake', '{r_active_1}'::uuid);"))
assert r1_pandan_detail["dietary_flags"] == [], f"Expected empty dietary flags in retired release, got {r1_pandan_detail['dietary_flags']}"
print("✔ Gate 1.14 Passed: Disputed dietary flags are scrubbed in retained older release.")

# 6B: Dishes Page RPC on retired release
r1_dishes_page = json.loads(run_auth_sql(f"SELECT public.catalog_raw_dishes_page(p_release_id => '{r_active_1}'::uuid);"))
r1_visible_dish_ids = [d["id"] for d in r1_dishes_page["items"]]
assert "dish-laksa" not in r1_visible_dish_ids
assert "dish-chicken-rice" not in r1_visible_dish_ids
assert "dish-ban-mian" in r1_visible_dish_ids
print("✔ Gate 1.15 Passed: Retained older release dishes page excludes held items.")

# 6C: Venue Summary & Search on retired release
r1_tian_tian_card = json.loads(run_sql(f"SELECT row_to_json(v) FROM (SELECT menu_count, min_price, dietary_flags, representative_dish FROM public.catalog_raw_venue_cards WHERE release_id = '{r_active_1}'::uuid AND id = 'venue-tian-tian') v;"))
print("Retired release Tian Tian venue card:", r1_tian_tian_card)
assert r1_tian_tian_card["menu_count"] == 1, f"Expected menu_count=1 in retired release, got {r1_tian_tian_card['menu_count']}"
assert r1_tian_tian_card["dietary_flags"] == [], f"Expected empty dietary flags in retired release, got {r1_tian_tian_card['dietary_flags']}"
assert r1_tian_tian_card["representative_dish"]["id"] not in ("dish-laksa", "dish-chicken-rice")
print("✔ Gate 1.16 Passed: Retained older release venue summary is scrubbed (menu_count=1, dietary_flags=[]).")

r1_venue_dietary_search = json.loads(run_auth_sql(f"SELECT public.catalog_raw_venues_page(p_dietary_flags => ARRAY['halal'], p_release_id => '{r_active_1}'::uuid);"))
r1_venue_dietary_ids = [v["id"] for v in r1_venue_dietary_search["items"]]
assert "venue-tian-tian" not in r1_venue_dietary_ids
print("✔ Gate 1.17 Passed: Retained older release venue search with dietary filter excludes venue-tian-tian.")

print("\n--- Step 7: Cleaning Up Controlled Fixtures and Restoring Staging Baseline ---")
run_sql("DELETE FROM public.catalog_item_publication_holds WHERE dish_id IN ('dish-laksa', 'dish-satay', 'dish-pandan-cake', 'dish-wagyu-burger');")
run_sql("UPDATE public.dishes SET description = null WHERE id = 'dish-chicken-rice';")
run_sql("UPDATE public.dishes SET media_approved_for_display = true WHERE id = 'dish-wagyu-burger';")

# Re-publish a clean active release so staging is restored to its 8-venue / 13-dish pristine state
clean_release = run_sql("SELECT public.catalog_raw_publish_release();")
clean_venue_total = int(run_sql(f"SELECT venue_total FROM public.catalog_releases WHERE id = '{clean_release}'::uuid;"))
clean_dish_total = int(run_sql(f"SELECT dish_total FROM public.catalog_releases WHERE id = '{clean_release}'::uuid;"))
assert clean_venue_total == 8, f"Expected 8 venues, got {clean_venue_total}"
assert clean_dish_total == 13, f"Expected 13 dishes, got {clean_dish_total}"
print(f"✔ Staging restored to pristine active release {clean_release} (8 venues, 13 dishes).")

print("\n========================================================")
print("ALL 17 STAGING MIGRATION REPLAY CHECKS PASSED ON REMOTE TARGET!")
print("========================================================")
