import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("discovery card feed returns source-backed card values separately", () => {
  const sql = read("supabase/migrations/20260713190000_discovery_card_truth.sql");
  for (const field of [
    "venue_image_url",
    "unit_number",
    "operating_hours",
    "building_image_url",
    "top_dish_image_source_type",
    "top_dish_price_range",
    "top_dish_food_type_tag",
    "top_dish_cuisine_tags",
    "top_dish_taste_tags",
  ]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`, "i"));
  }
  assert.match(sql, /where base\.top_dish_price > 0/i);
  assert.match(sql, /order by\s+enriched\.distance_meters/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all[\s\S]*from public/i);
  assert.match(sql, /grant execute[\s\S]*to anon, authenticated/i);
});

test("Supabase repository prefers the enriched card feed and preserves cuisine semantics", () => {
  const source = read("src/lib/services/supabase/supabaseRepository.ts");
  const venueMapper = source.match(
    /function mapDiscoveryFeedVenue[\s\S]*?(?=\nfunction mapDiscoveryFeedDish)/,
  )?.[0];
  const dishMapper = source.match(
    /function mapDiscoveryFeedDish[\s\S]*?(?=\nfunction mapUserFoodCred)/,
  )?.[0];
  assert.ok(venueMapper, "Discovery venue mapper must remain present");
  assert.ok(dishMapper, "Discovery dish mapper must remain present");
  assert.match(source, /rpcRows\("get_discovery_card_feed_by_location"/);
  assert.match(source, /foodTypeTag: toString\(row\.food_type_tag\)/);
  assert.match(source, /cuisineTags: toStringArray\(row\.cuisine_tags\)/);
  assert.match(venueMapper, /operatingHours: toString\(row\.operating_hours\)/);
  assert.match(dishMapper, /price_range: row\.top_dish_price_range/);
  assert.match(source, /taste_tags: row\.top_dish_taste_tags/);
  assert.doesNotMatch(source, /taste_tags: row\.cuisine_tags/);
});
