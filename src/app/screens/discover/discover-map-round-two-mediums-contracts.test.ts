import assert from "node:assert/strict";
import test from "node:test";

import { assertRepoFileExists, readRepoFile } from "@/test/sourceContracts";
import { existsSync } from "node:fs";
import path from "node:path";

const map = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");
const surface = readRepoFile("src/components/map/MapSurface.tsx");
const legend = readRepoFile("src/components/map/BuildingLegend.tsx");

test("M8: tapping the map folds the sheet and leaves the camera alone", () => {
  assert.match(map, /onMapPress=\{\(\) => \{/);
  assert.doesNotMatch(map, /onMapPress=\{\(coordinate\)/);
  assert.doesNotMatch(map, /setMapCenter\(coordinate\)/);
});

test("M9: pins are coloured by building type and the legend draws the same mapping", () => {
  assert.match(map, /accent: getBuildingPinColor\(item\.buildingType, palette\)/);
  assert.match(map, /accent: getClusterPinColor\(palette\)/);
  assert.doesNotMatch(map, /verificationStatus === "approved" \? palette\.orange/);
  assert.match(legend, /getBuildingPinColor\("hawker_centre", palette\)/);
  assert.match(legend, /Group of places/);
});

test("M10: a pin selects its card, a card swipe selects its pin, and an empty map says so", () => {
  assert.match(map, /setSelectedVenueId\(item\.id\)/);
  assert.match(map, /carouselRef\.current\?\.scrollTo/);
  assert.match(map, /onMomentumScrollEnd/);
  assert.match(map, /No places here\. Zoom out or clear filters\./);
  // Cards read the same region as the pins.
  assert.match(map, /radiusMeters: cardRadiusMeters/);
  assert.match(map, /minRating: mapFilters\.topRated \? TOP_RATED_MIN_RATING : undefined/);
});

test("M11/M12: Open now reads each stall's hours, never the stored flag, and Top Rated needs reviews", () => {
  assert.match(map, /\{ id: "openNow", label: "Open now" \}/);
  assert.match(map, /openLabelByVenue\.get\(card\.id\) === "Open"/);
  assert.doesNotMatch(map, /venue\.isOpen|\.isOpen\b/);
  const migration = readRepoFile(
    "supabase/migrations/20261022040000_catalog_raw_map_view_query_rating_nearest.sql",
  );
  assert.match(migration, /c\.quality_review_count >= 3/);
});

test("M13/M14: every pin is a labelled button, memoised, and the count is capped", () => {
  assert.match(surface, /accessibilityRole="button"/);
  assert.match(surface, /accessibilityLabel=\{marker\.accessibilityLabel \?\? marker\.label\}/);
  assert.match(surface, /const MapMarkerButton = memo\(/);
  assert.equal(surface.match(/<MapMarkerButton/g)?.length, 2);
  assert.match(map, /\.slice\(0, MAX_RENDERED_MARKERS\)/);
});

test("M19: a map search stays on the map as a query on the pins and the cards", () => {
  assert.doesNotMatch(map, /navigation\.navigate\("SearchResults", \{ initialQuery: query/);
  // The pins, the cards and (for the dish a card names) the dishes all carry the query.
  assert.equal(map.match(/\bquery,\n/g)?.length, 3);
  assert.match(map, /setMapQuery\(query\)/);
  const catalog = readRepoFile("src/lib/services/catalog/index.ts");
  assert.match(catalog, /p_query: request\.query\.trim\(\)/);
});

test("L1: the chosen building and highlight are cleared when the map closes", () => {
  assert.match(map, /setSelectedBuilding\(undefined\)/);
});

test("L5: dead floorplan viewers are gone and unused imports removed", () => {
  assert.equal(
    existsSync(path.join(process.cwd(), "src/components/map/FloorPlanViewer.tsx")),
    false,
  );
  assert.equal(
    existsSync(path.join(process.cwd(), "src/components/map/SkiaFloorplanViewer.tsx")),
    false,
  );
  assertRepoFileExists("src/components/map/FloorSelector.tsx");
  assert.doesNotMatch(readRepoFile("src/components/map/index.ts"), /FloorPlanViewer|FloorSelector/);
  // Star is the fallback of the rating symbol on Android and web.
  assert.doesNotMatch(map, /\b(Filter|Heart),/);
  const zoomed = readRepoFile("src/app/screens/discover/MapZoomedInScreen.tsx");
  assert.doesNotMatch(zoomed, /\bStar\b/);
  assert.match(zoomed, /getEffectiveLocation/);
});

test("L10: push opens are logged as a push surface and the map events exist", () => {
  assert.match(
    readRepoFile("src/app/navigation/linking.ts"),
    /createStateOverHome\("DecideForMeResult", \{ surface: "push" \}\)/,
  );
  assert.match(readRepoFile("src/app/navigation/navigationTypes.ts"), /"discover" \| "push"/);
  assert.match(map, /trackAnalyticsEvent\("map_opened"/);
  assert.match(map, /trackAnalyticsEvent\("map_filter_toggled"/);
  const decide = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.doesNotMatch(decide, /radius_m: 500/);
});

test("L11: sheet heights follow the screen", () => {
  assert.match(map, /const FULL_HEIGHT = Math\.min\(620, Math\.round\(screenHeight \* 0\.7\)\)/);
  // The list rests collapsed, half-way (LIST_HEIGHT) or full; the cards rest collapsed or open.
  assert.match(map, /\[MINIMIZED_HEIGHT, LIST_HEIGHT, FULL_HEIGHT\]/);
  assert.match(map, /\[MINIMIZED_HEIGHT, CAROUSEL_HEIGHT\]/);
});

test("L13: pressing the Map toggle does not preload the Mapbox screen", () => {
  assert.match(
    readRepoFile("src/features/navigation/prefetch.ts"),
    /NON_PRELOADABLE_ROUTES[^;]*"DiscoverMap"/,
  );
});

test("M18: the Decide price uses the accessible accent colour", () => {
  const decide = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.match(decide, /style=\{\{ color: palette\.accentText \}\}>\s*\{formatDishPrice\(dish\)\}/);
});

test("L7/L12: catalog detail shows address and hours once, Crave never claims 'seen it all' empty", () => {
  const detail = readRepoFile("src/app/screens/catalog/CatalogRawDetailScreen.tsx");
  assert.match(detail, /venueAddress/);
  assert.match(detail, /venueHours/);
  const crave = readRepoFile("src/app/screens/discover/CraveScreen.tsx");
  assert.match(crave, /No dishes to swipe yet/);
  assert.match(crave, /isLoadingDeck/);
});
