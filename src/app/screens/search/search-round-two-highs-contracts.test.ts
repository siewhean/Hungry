import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { useSearchStore } from "@/store/useSearchStore";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SEARCH_MIGRATION =
  "supabase/migrations/20261021150000_catalog_search_distance_places_stall_dishes.sql";
const RIGHTS_MIGRATION = "supabase/migrations/20261021150100_catalog_raw_card_display_rights.sql";
const SUGGEST_MIGRATION = "supabase/migrations/20261021150200_catalog_suggest.sql";

test("H20: both page RPCs return the computed distance, not the stored column", () => {
  const sql = read(SEARCH_MIGRATION);
  const projections = sql.match(
    /\|\| jsonb_build_object\('distance_meters', nullif\(computed_distance, 2147483647\)\)/g,
  );
  assert.equal(projections?.length, 2, "dishes and venues pages both report distance_meters");
  assert.match(
    sql,
    /grant execute on function public\.catalog_raw_dishes_page\([^)]*\) to anon, authenticated;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.catalog_raw_venues_page\([^)]*\) to anon, authenticated;/,
  );
  assert.equal(sql.match(/returns jsonb language plpgsql security definer/g)?.length, 2);
  // The client already maps distance_meters for both card kinds (and for places).
  const service = read("src/lib/services/catalog/index.ts");
  assert.equal(service.match(/distanceMeters: asNumber\(row\.distance_meters\)/g)?.length, 3);
});

test("H21: map and Quick Bites keep raw text locally and open results with the query", () => {
  assert.doesNotMatch(read("src/store/useSearchStore.ts"), /updateQuery/);
  assert.equal("updateQuery" in useSearchStore.getState(), false);
  for (const file of [
    "src/app/screens/discover/HomeMapScreen.tsx",
    "src/app/screens/discover/QuickBitesScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /const \[searchText, setSearchText\] = useState\(""\)/);
    assert.match(source, /onQueryChange=\{setSearchText\}/);
    assert.match(source, /const query = sanitizeSearchQuery\(searchText\)/);
    assert.doesNotMatch(source, /state\.filters\.query|navigate\("SearchHome"\)/);
  }
  assert.match(
    read("src/app/screens/discover/QuickBitesScreen.tsx"),
    /navigation\.navigate\("SearchResults", \{ initialQuery: query \|\| undefined \}\)/,
  );
  // The map keeps the query on the map; "See all results" is the way out to Search.
  const map = read("src/app/screens/discover/HomeMapScreen.tsx");
  assert.match(map, /setMapQuery\(query\)/);
  assert.match(map, /navigation\.navigate\("SearchResults", \{ initialQuery: mapQuery \}\)/);
  assert.doesNotMatch(read("src/app/screens/discover/DiscoverHomeScreen.tsx"), /updateQuery/);
});

test("H22: Search has no Open now chip while is_open only tracks closures", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.doesNotMatch(grid, /"Open now"/);
  assert.doesNotMatch(grid, /openOnly:/);
});

test("H23: searches match building names and stall search matches the stall's dishes", () => {
  const sql = read(SEARCH_MIGRATION);
  assert.match(sql, /catalog_raw_dish_cards_building_name_trgm_idx/);
  assert.match(sql, /catalog_raw_venue_cards_building_name_trgm_idx/);
  assert.equal(sql.match(/c\.building_name ilike '%' \|\| p_query \|\| '%'/g)?.length, 2);
  assert.match(
    sql,
    /with dish_matches as materialized \([\s\S]*from public\.catalog_raw_dish_cards dc/,
  );
  assert.match(sql, /or dm\.venue_id is not null\)/);

  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.match(grid, /<RawCatalogBrowseGrid\s+allowModeSwitch/);
  assert.match(grid, /accessibilityRole="tablist"/);
  assert.match(grid, /trackAnalyticsEvent\("search_mode_changed"/);
});

test("H24: Search home suggests as you type and shows popular food types", () => {
  const sql = read(SUGGEST_MIGRATION);
  assert.match(
    sql,
    /create or replace function public\.catalog_suggest\(p_prefix text default null, p_limit integer default 8\)/,
  );
  assert.match(sql, /security definer/);
  assert.match(sql, /char_length\(v_prefix\) < 2/);
  assert.match(sql, /'%', '\\%'\), '_', '\\_'\)/);
  assert.match(
    sql,
    /grant execute on function public\.catalog_suggest\(text, integer\) to anon, authenticated;/,
  );

  assert.match(read("src/lib/services/catalog/index.ts"), /callRawRpc\("catalog_suggest", args\)/);
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(home, /\.suggest\(trimmedSearchText\)/);
  assert.match(home, /Popular dishes/);
  assert.match(
    home,
    /openResults\(suggestion\.label, "search_suggestion", suggestionMode\(suggestion\)\)/,
  );
});

test("H25: cards without a photo show the stall's initials, not a grey caption", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.doesNotMatch(grid, /Image unavailable/);
  assert.match(grid, /<StallLogoMark name=\{stallName\}/);
});

test("H26: raw cards store only images cleared by catalog_display_image_url", () => {
  const sql = read(RIGHTS_MIGRATION);
  for (const source of [
    "d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url",
    "di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url",
    "v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url",
  ]) {
    assert.ok(sql.includes(`catalog_display_image_url(${source})`), source);
  }
  assert.match(sql, /before insert on public\.catalog_raw_dish_cards/);
  assert.match(sql, /before insert on public\.catalog_raw_venue_cards/);
  assert.match(sql, /'\{image_url\}'/);
  assert.match(sql, /update public\.catalog_raw_dish_cards c\s+set image_url/);
  // Triggers fire in name order; this one must run after the draft trigger.
  assert.ok("trg_catalog_raw_venue_display_images" > "trg_catalog_raw_venue_card_without_drafts");
});
