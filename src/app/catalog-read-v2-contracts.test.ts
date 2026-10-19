import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("catalog read v2 uses RPC pages instead of the BrowseIndex in its active branch", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.match(source, /FEATURE_FLAGS\.catalogReadV2/);
  assert.match(source, /RawCatalogBrowseGrid/);
  assert.match(source, /service\.listDishes\(request\)/);
  assert.match(source, /service\.listVenues\(request\)/);
  assert.match(source, /LegacyBrowseGridScreen/);
  assert.match(source, /export function SearchResultsScreen\(\)[\s\S]*RawCatalogBrowseGrid/);
  assert.match(source, /const storedQuery = useSearchStore\(\(state\) => state\.filters\.query\)/);
  assert.match(
    source,
    /const selectedCategories = useSearchStore\(\(state\) => state\.filters\.categories\)/,
  );
  assert.match(source, /const storedCatalogCategory = selectedCategories\.find/);
  assert.match(source, /initialSearchQuery=\{route\.params\?\.initialQuery \?\? storedQuery\}/);
  assert.match(
    source,
    /initialFoodTypeTag=\{route\.params\?\.foodTypeTag \?\? storedCatalogCategory\}/,
  );
  assert.match(source, /request\.releaseId = cursor \? releaseIdRef\.current : undefined/);
});

test("raw catalog service is authenticated, cursor-paged, and non-persistent", () => {
  const source = read("src/lib/services/catalog/index.ts");
  assert.match(source, /client\.auth\.getSession\(\)/);
  assert.match(source, /catalog_raw_dishes_page/);
  assert.match(source, /catalog_raw_venues_page/);
  assert.match(source, /catalog_raw_map_view/);
  assert.match(source, /p_building_types/);
  assert.match(source, /MAX_CACHE_ENTRIES = 40/);
  assert.doesNotMatch(source, /AsyncStorage|persist\(/);
});

test("raw catalog migration preserves a separate authenticated release lane", () => {
  const migration = read("supabase/migrations/20260713120000_versioned_raw_catalog_reads.sql");
  assert.match(migration, /catalog_releases/);
  assert.match(migration, /expires_at = now\(\) \+ interval '24 hours'/);
  assert.match(migration, /catalog_raw_require_authenticated/);
  assert.match(migration, /set status = 'failed'[\s\S]*return v_release_id/);
  assert.equal(
    [...migration.matchAll(/cursor_row as \([\s\S]*?where exists \(select 1 from tail\)/g)].length,
    2,
    "both page RPCs must build their cursor from the final visible row",
  );
  assert.equal(
    [...migration.matchAll(/jsonb_agg\([\s\S]*?order by[\s\S]*?p_sort = 'nearby'/g)].length,
    2,
    "both page RPCs must preserve their stable page order in JSON",
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /catalog_raw_venue_cards enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.catalog_raw_venue_cards from public, anon, authenticated/,
  );
  assert.match(migration, /p_sort = 'relevance'/);
  assert.match(migration, /c\.cuisine_tags && p_cuisine_tags/);
  assert.doesNotMatch(migration, /->>'id\)/);
  assert.match(
    migration,
    /grant execute on function public\.catalog_raw_dishes_page[\s\S]+to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.catalog_raw_dishes_page[\s\S]+to anon/,
  );
});

test("V2 discovery entry points do not warm the legacy browse index and map passes viewport filters", () => {
  const prefetch = read("src/features/navigation/prefetch.ts");
  const searchHome = read("src/app/screens/search/DishSearchScreen.tsx");
  const discoverHome = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const map = read("src/app/screens/discover/HomeMapScreen.tsx");
  assert.match(prefetch, /FEATURE_FLAGS\.catalogReadV2[\s\S]*return;/);
  assert.match(
    prefetch,
    /export function prefetchDishDetail[\s\S]*FEATURE_FLAGS\.catalogReadV2[\s\S]*return;/,
  );
  assert.match(
    prefetch,
    /export function prefetchStallDetail[\s\S]*FEATURE_FLAGS\.catalogReadV2[\s\S]*return;/,
  );
  assert.match(searchHome, /shouldUseCatalogReadV2[\s\S]*getDiscoverStallCollections/);
  assert.doesNotMatch(searchHome, /FEATURE_FLAGS\.catalogReadV2 && isAuthenticated/);
  assert.match(
    discoverHome,
    /if \(shouldUseCatalogReadV2\) \{\s*return;\s*\}[\s\S]*refreshPopularNearby/,
  );
  assert.doesNotMatch(discoverHome, /FEATURE_FLAGS\.catalogReadV2 && isAuthenticated/);
  assert.match(map, /onViewportChange/);
  assert.match(map, /buildingTypes/);
  assert.match(map, /openOnly: mapFilters\.openNow/);
  assert.match(
    map,
    /onMarkerPress=\{shouldUseCatalogReadV2 \? handleRawMarkerPress : handleLegacyMarkerPress\}/,
  );
  assert.match(map, /candidate\.kind === "venue" \? "stall" : candidate\.kind/);
});

test("catalog release publisher fails when count validation does not activate a release", () => {
  const publisher = read("scripts/publish-catalog-raw-release.mjs");
  assert.match(publisher, /result\.rows\?\.\[0\]\?\.status !== "active"/);
  assert.match(publisher, /process\.exitCode = 1/);
});
