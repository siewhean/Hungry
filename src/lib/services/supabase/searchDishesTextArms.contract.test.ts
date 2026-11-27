import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const up = read("supabase/migrations/20261127140000_search_dishes_text_arms.sql");
const down = read("supabase/rollbacks/20261127140000_search_dishes_text_arms.down.sql");
const smoke = read("supabase/smoke/search_dishes_text_arms.sql");

test("tag search is index backed and the fuzzy name read narrows once 250 substring matches exist", () => {
  for (const index of [
    "idx_dishes_food_type_trgm",
    "idx_dishes_taste_tags_trgm",
    "idx_dishes_cuisine_tags_trgm",
    "idx_venues_cuisine_tags_trgm",
  ]) {
    assert.match(up, new RegExp(`create index ${index}`));
    assert.match(down, new RegExp(`drop index public\\.${index}`));
  }
  // A substring match scores at least 0.65, so with 250 of them a looser match cannot reach the top 250.
  assert.match(up, /select count\(\*\) >= 250 as many/);
  assert.match(up, /set pg_trgm\.similarity_threshold = '0\.6499999761581421'/);
  assert.match(up, /greatest\(r\.name_sim, 0\.65::real\)/);
});

test("helpers run as the caller and never inline, so the query text reaches the index", () => {
  for (const name of [
    "search_dish_name_ilike_rows",
    "search_dish_name_fuzzy_rows",
    "search_dish_name_close_rows",
    "search_dish_tag_ids",
  ]) {
    assert.match(up, new RegExp(`create function app_private\\.${name}\\(q text\\)`));
    assert.match(
      up,
      new RegExp(
        `grant execute on function app_private\\.${name}\\(text\\) to anon, authenticated, service_role`,
      ),
    );
    assert.match(down, new RegExp(`drop function app_private\\.${name}\\(text\\)`));
  }
  assert.doesNotMatch(up, /security definer/i);
  assert.match(up, /set search_path = pg_catalog, public, extensions/);
});

test("the patch only touches the unscoped text arms and is checked by hash both ways", () => {
  assert.match(up, /search_dishes unscoped text arms differ from the expected definition/);
  assert.match(up, /ac26730221016f1071b4d031852f35d5/);
  assert.match(down, /600bba861457ddf41557e42e7241c350/);
  assert.match(down, /ac26730221016f1071b4d031852f35d5|\$old\$/);
});

test("smoke covers name, near miss, hidden dish, broad page, tags and stall scope", () => {
  assert.match(up, /-- smoke: supabase\/smoke\/search_dishes_text_arms\.sql/);
  for (const needle of [
    "Zorblat Noodle",
    "smoke-sta-hidden-1",
    "Bulkwok Dish",
    "smoketagqxz",
    "smokefoodqxz",
    "smokecuisqxz",
    "smokevtagqxz",
    "p_venue_id => 'smoke-sta-v2'",
  ]) {
    assert.ok(smoke.includes(needle), `smoke lacks ${needle}`);
  }
});
