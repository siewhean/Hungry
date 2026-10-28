// 20261028090000: get_taste_recommendations returns the card fields. Static checks on the
// migration, its down file and its smoke (the staging rehearsal is what proves them on a database).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const UP = read("supabase/migrations/20261028090000_taste_recommendations_card_fields.sql");
const DOWN = read("supabase/rollbacks/20261028090000_taste_recommendations_card_fields.down.sql");
const SMOKE = read("supabase/smoke/taste_recommendations_card_fields.sql");

const SIGNATURE =
  "text, double precision[], text[], text, double precision, double precision, integer, text[], integer";

test("the function keeps its signature, volatility, search_path and grants", () => {
  for (const sql of [UP, DOWN]) {
    assert.match(sql, /drop function if exists public\.get_taste_recommendations\(/);
    assert.match(sql, /create function public\.get_taste_recommendations\(/);
    assert.match(sql, /\nvolatile\nsecurity invoker\nset search_path = public, extensions\n/);
    assert.ok(
      sql.includes(
        `grant execute on function public.get_taste_recommendations(${SIGNATURE}) to anon, authenticated;`,
      ),
    );
  }
  assert.match(UP, /notify pgrst, 'reload schema'/);
});

test("the new columns follow the five ranking columns, in the order the app reads them", () => {
  const returns = UP.slice(UP.indexOf("returns table ("), UP.indexOf("language sql"));
  const columns = [...returns.matchAll(/^\s{2}(\w+) [a-z]/gm)].map((match) => match[1]);
  assert.deepEqual(columns.slice(0, 5), [
    "dish_id",
    "match_score",
    "match_percent",
    "match_reason",
    "is_serendipitous",
  ]);
  for (const column of [
    "venue_id",
    "building_id",
    "venue_name",
    "unit_number",
    "floor",
    "name",
    "image_url",
    "distance_meters",
    "rating",
    "review_count",
    "price",
    "price_range",
    "food_type",
    "taste_tags",
    "taste_vector",
    "dietary_flags",
    "latitude",
    "longitude",
  ]) {
    assert.ok(columns.includes(column), `${column} is returned`);
  }
});

test("candidates pass the checks the published catalog applies", () => {
  assert.match(UP, /d\.archived_at is null/);
  assert.match(UP, /not d\.merchant_draft/);
  assert.match(UP, /catalog_menu_is_displayable\(d\.menu_approved_for_display/);
  assert.match(UP, /app_private\.catalog_excluded_venues ex where ex\.venue_id = d\.venue_id/);
  // The photo is the dish's own, rights-checked; a stall photo is never borrowed.
  assert.match(UP, /catalog_display_image_url\(\s*d\.image_url, d\.media_approved_for_display/);
  assert.doesNotMatch(UP, /catalog_display_image_url\(\s*v\.image_url/);
});

test("the ranking is the one already in production", () => {
  for (const line of [
    "0.50 * tg.confidence * tg.taste_score",
    "0.80 * vc.vector_score",
    "order by dtv.vector <=> params.user_vector",
  ]) {
    assert.ok(UP.includes(line), line);
    assert.ok(DOWN.includes(line), line);
  }
});

test("the down file puts back the five-column function and touches no data", () => {
  const returns = DOWN.slice(DOWN.indexOf("returns table ("), DOWN.indexOf("language sql"));
  assert.doesNotMatch(returns, /venue_name|taste_vector|latitude/);
  assert.doesNotMatch(DOWN, /\b(delete from|truncate|drop table)\b/i);
});

test("the smoke names itself in the migration and covers the filters, the pin and the grants", () => {
  assert.match(UP, /^-- smoke: supabase\/smoke\/taste_recommendations_card_fields\.sql/);
  for (const needle of [
    "smoke-0049-archived",
    "smoke-0049-draft",
    "smoke-0049-unapproved",
    "smoke-0049-seven",
    "provolatile",
    "has_function_privilege('anon'",
    "rollback;",
  ]) {
    assert.ok(SMOKE.includes(needle), needle);
  }
  assert.doesNotMatch(SMOKE, /\bcommit;/);
});
