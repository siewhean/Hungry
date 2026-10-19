import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("search and browse read only the paged catalog (no legacy path or flag)", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.doesNotMatch(source, /catalogReadV2|LegacyBrowseGridScreen|LegacySearchResultsScreen/);
  assert.doesNotMatch(source, /browseIndex|getDataRepository|SearchResultsView/);
  assert.match(source, /RawCatalogBrowseGrid/);
  assert.match(source, /service\.listDishes\(request\)/);
  assert.match(source, /service\.listVenues\(request\)/);
  assert.match(source, /export function SearchResultsScreen\(\)[\s\S]*RawCatalogBrowseGrid/);
  assert.match(
    source,
    /export function BrowseDishesScreen\(\)[\s\S]*<RawCatalogBrowseGrid mode="dishes"/,
  );
  assert.match(
    source,
    /export function BrowseStallsScreen\(\)[\s\S]*<RawCatalogBrowseGrid mode="stalls"/,
  );
  // Results read only route params: a persisted query or category never leaks into a new search.
  assert.doesNotMatch(source, /useSearchStore|storedQuery/);
  assert.match(source, /initialSearchQuery=\{route\.params\?\.initialQuery \?\? ""\}/);
  assert.match(
    source,
    /initialFilter=\{route\.params\?\.initialFilter \?\? route\.params\?\.foodTypeTag\}/,
  );
  assert.match(source, /request\.releaseId = cursor \? releaseIdRef\.current : undefined/);

  const flags = read("src/constants/featureFlags.ts");
  assert.doesNotMatch(flags, /catalogReadV2|CATALOG_READ_V2/);
  const eas = read("eas.json");
  assert.doesNotMatch(eas, /CATALOG_READ_V2/);
});

test("every data source serves the catalog contract (no null service, no Supabase-only gate)", () => {
  const provider = read("src/lib/services/serviceProvider.ts");
  assert.match(provider, /export function getCatalogRawService\(\): CatalogRawService \{/);
  assert.match(provider, /createLocalCatalogService\(provider\.repository\)/);
  const detail = read("src/app/screens/catalog/CatalogRawDetailScreen.tsx");
  assert.doesNotMatch(detail, /getServiceProvider\(\)\.mode !== "supabase"/);
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

test("discovery entry points never warm a local catalog index and map passes viewport filters", () => {
  const prefetch = read("src/features/navigation/prefetch.ts");
  const searchHome = read("src/app/screens/search/DishSearchScreen.tsx");
  const discoverHome = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const map = read("src/app/screens/discover/HomeMapScreen.tsx");
  assert.doesNotMatch(prefetch, /catalogReadV2|browseIndex|getBrowseIndex/);
  assert.match(
    prefetch,
    /export function prefetchDishDetail[\s\S]*getServiceProvider\(\)\.mode === "supabase"\) \{\s*return;/,
  );
  assert.match(
    prefetch,
    /export function prefetchStallDetail[\s\S]*getServiceProvider\(\)\.mode === "supabase"\) \{\s*return;/,
  );
  assert.match(
    prefetch,
    /export function prefetchBrowseResults[\s\S]*preloadRoute\(navigation, "SearchResults"/,
  );
  assert.doesNotMatch(searchHome, /getDiscoverStallCollections|getSearchResultsAsync|TasteFilter/);
  assert.doesNotMatch(discoverHome, /catalogReadV2|refreshPopularNearby/);
  assert.match(map, /onViewportChange/);
  assert.match(map, /buildingTypes/);
  assert.match(map, /openOnly: mapFilters\.openNow/);
  assert.match(map, /onMarkerPress=\{handleRawMarkerPress\}/);
  assert.doesNotMatch(map, /catalogReadV2|handleLegacyMarkerPress|getDataRepository/);
  assert.match(map, /candidate\.kind === "venue" \? "stall" : candidate\.kind/);
});

test("catalog release publisher fails when count validation does not activate a release", () => {
  const publisher = read("scripts/publish-catalog-raw-release.mjs");
  assert.match(publisher, /result\.rows\?\.\[0\]\?\.status !== "active"/);
  assert.match(publisher, /process\.exitCode = 1/);
});
