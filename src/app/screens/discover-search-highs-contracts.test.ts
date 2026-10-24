import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

test("Discover feed falls back to the radius search and ranks by computed distance", () => {
  const migration = readRepoFile(
    "supabase/migrations/20261019130000_discovery_feed_area_fallback_distance.sql",
  );
  const smoke = readRepoFile("supabase/smoke/discovery_feed_area_fallback_distance.sql");

  assert.match(migration, /security invoker/i);
  assert.match(migration, /where not \(params\.area_requested and params\.area_found\)/);
  assert.doesNotMatch(migration, /top_dish\.distance_meters/);
  assert.doesNotMatch(migration, /priced_menu_venues/);
  assert.match(
    migration,
    /order by filtered\.has_menu desc, filtered\.request_distance_meters asc nulls last/,
  );
  assert.match(smoke, /Hungry Smoke Unknown Area/);
  assert.match(smoke, /^rollback;/m);
});

test("Discover asks for an area instead of asserting the default location", () => {
  const screen = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");

  // No OS permission prompt on mount; only the "Use current location" press asks.
  assert.doesNotMatch(screen, /useEffect\(\(\) => \{[^}]*grantLocation\(/);
  assert.match(screen, /const handleUseCurrentLocation = useCallback\(async \(\) => \{/);
  // Owner decision (round 3): always an area, never just "Singapore"; the area is in orange.
  assert.doesNotMatch(screen, /needsDiscoverAreaChoice\s*\?\s*"Singapore"/);
  assert.match(
    screen,
    /getNearestSingaporeArea\(discoverLocationLatitude, discoverLocationLongitude\)/,
  );
  assert.match(screen, /You are at\s*<\/AppText>/);
  assert.match(
    screen,
    /style=\{\{ color: themeTints\.text \}\} numberOfLines=\{1\}>\s*\{discoverHeaderLabel\}/,
  );
  assert.match(
    screen,
    /navigation\.navigate\("OnboardingStack", \{ screen: "ManualLocationPicker" \}\)/,
  );
});

test("Decide for me picks and logs once, on the result screen, at the effective location", () => {
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const result = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const handler =
    discover.match(/const handleDecideForMe = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";

  assert.ok(handler, "handleDecideForMe should exist");
  assert.doesNotMatch(handler, /getDecideForMe|searchDishes|recordTasteInteraction/);
  assert.match(handler, /setDecideForMe\(undefined\)/);
  // The app's own pick is an impression, never logged as a click (behaviour test:
  // discover/decide.render.test.tsx).
  assert.doesNotMatch(result, /buttonId: "decide_for_me"/);
  assert.match(result, /recordImpression\("decide", \[dish\.id\]\)/);
  assert.match(result, /isLocationApproximate \? undefined : formatDistance/);
});

test("Discover rails no longer claim prep times or curation they do not have", () => {
  const screen = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");

  assert.doesNotMatch(screen, /&lt; 15 MIN|★ CURATED|MUST ORDER|Editor&apos;s Choice/);
  assert.match(screen, /title=\{`Trending \$\{trendingAreaPhrase\}`\}/);
  assert.match(screen, /Top rated/);
});

test("Top rated rail never falls back to trending dishes under its 4.4+ label", () => {
  const screen = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const editorChoice =
    screen.match(/const unfilteredEditorChoiceCards = useMemo\([\s\S]*?\n {2}\);/)?.[0] ?? "";

  assert.ok(editorChoice, "unfilteredEditorChoiceCards should exist");
  assert.doesNotMatch(editorChoice, /trending/);
  // A dish with no reviews shows no rating instead of "0.0".
  assert.match(screen, /const hasRating = bite\.cravingCount > 0 && bite\.rating > 0;/);
});

test("Crave swipes act on the current card and record taste signals", () => {
  const crave = readRepoFile("src/app/screens/discover/CraveScreen.tsx");

  assert.match(crave, /swipeHandlersRef\.current\.swipeRight\(\)/);
  assert.match(crave, /swipeHandlersRef\.current = \{ swipeRight, swipeLeft \}/);
  assert.match(crave, /profile\.favouriteDishIds\.includes\(currentDish\.id\)/);
  assert.match(crave, /buttonId: "crave_swipe_left"/);
});

test("Home map centres on the user, wires catalog pins and keeps Mapbox attribution", () => {
  const map = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");
  const surface = readRepoFile("src/components/map/MapSurface.tsx");

  assert.match(map, /centerCoordinate=\{mapCenter\}/);
  assert.match(map, /currentLocation=\{isLocationApproximate \? undefined : currentLocation\}/);
  assert.match(map, /onMarkerPress=\{handleRawMarkerPress\}/);
  assert.match(map, /displayModeRef\.current === "list"/);
  assert.match(map, /"Recenter map on your location"/);
  assert.doesNotMatch(map, /Recenter map to default building/);
  assert.doesNotMatch(surface, /attributionEnabled=\{false\}|logoEnabled=\{false\}/);
  assert.match(surface, /__DEV__\s*\?\s*"Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`/);
});

test("Screens with analytics mount effects are never preloaded", () => {
  const prefetch = readRepoFile("src/features/navigation/prefetch.ts");
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");

  assert.match(
    prefetch,
    /NON_PRELOADABLE_ROUTES[\s\S]*"DecideForMeResult"[\s\S]*"MapZoomedIn"[\s\S]*"QuickBites"/,
  );
  assert.match(prefetch, /if \(NON_PRELOADABLE_ROUTES\.has\(routeName\)\) \{\s*return;/);
  assert.doesNotMatch(
    discover,
    /preloadRoute\(navigation, "(DecideForMeResult|MapZoomedIn|QuickBites)"/,
  );
});

test("Collections are folded into Lists: no Collection screens, store or routes remain", () => {
  for (const removed of [
    "src/app/screens/discover/CollectionListScreen.tsx",
    "src/app/screens/discover/CollectionDetailScreen.tsx",
    "src/components/collections/CollectionCard.tsx",
    "src/store/useCollectionStore.ts",
  ]) {
    assert.equal(existsSync(path.join(process.cwd(), removed)), false, removed);
  }
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
  const navigationTypes = readRepoFile("src/app/navigation/navigationTypes.ts");
  const repositoryTypes = readRepoFile("src/lib/services/types.ts");
  assert.doesNotMatch(rootNavigator, /Collection(List|Detail)/);
  assert.doesNotMatch(navigationTypes, /Collection(List|Detail)/);
  assert.doesNotMatch(repositoryTypes, /listCollections|FoodCollection/);

  // The stall "Add to List" action saves into the user's Lists (portfolio) flow.
  const bar = readRepoFile("src/components/stall/StallInteractionBar.tsx");
  const stallDetail = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(bar, /onAddToList\?: \(\) => void;/);
  assert.doesNotMatch(bar, /onAddToCollection/);
  assert.match(
    stallDetail,
    /onAddToList=\{\s*showDeferredDetailControls && FEATURE_FLAGS\.portfoliosEnabled\s*\? \(\) => void detailSaveActions\.addToPortfolio\(\)/,
  );
});

test("Search hides empty sections and controls the backend ignores", () => {
  const home = readRepoFile("src/app/screens/search/DishSearchScreen.tsx");
  const results = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");
  const repository = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");

  assert.doesNotMatch(home, /within 2km/);
  // The paged catalog has no local suggestions or taste sliders, and maps only
  // noodles/rice into a cuisine filter, so the landing offers just those chips.
  assert.doesNotMatch(home, /suggestedDish|collections|TasteFilter|getSearchResultsAsync/);
  assert.match(home, /const CATALOG_CATEGORIES: SearchCategory\[\] = \["noodles", "rice"\]/);
  const browseGrid = readRepoFile("src/features/search/browseGrid.ts");
  assert.match(
    browseGrid,
    /radiusMeters: query \|\| input\.buildingId \? undefined : BROWSE_RADIUS_METERS/,
  );
  assert.match(browseGrid, /BROWSE_RADIUS_METERS = 3_000/);
  assert.doesNotMatch(results, /rawCatalogRequest/);
  // Only location browsing is radius-bound, and never with a radius past Postgres int range.
  assert.match(
    repository,
    /p_radius_meters:\s*hasLocation && !query && filters\.radius > 0 && filters\.radius <= 2_147_483_647\s*\? Math\.round\(filters\.radius\)\s*: null/,
  );
});

test("Search browse: guests can browse, chips never show everything, errors stay friendly", () => {
  const results = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");

  // The catalog is guest-readable, so there is no sign-in wall on browse.
  assert.doesNotMatch(results, /Sign in to browse the full directory/);
  assert.match(
    readRepoFile("src/features/search/browseGrid.ts"),
    /dietaryFlags: input\.filters\.includes\("Halal"\) \? \["halal"\] : \[\]/,
  );
  assert.doesNotMatch(results, /body=\{error\}/);
  assert.match(results, /errorMessage=\{error\}/);
  assert.match(results, /reportError\(loadError/);
});

test("Area picker returns already-onboarded users without re-completing onboarding", () => {
  const picker = readRepoFile("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  const submit =
    picker.match(/const finish = \(message: string\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";

  assert.ok(submit, "finish should exist");
  assert.match(
    submit,
    /if \(!isOnboarding\) \{[\s\S]*?navigation\.goBack\(\);\s*return;\s*\}[\s\S]*?navigation\.navigate\("TasteQuiz"\)/,
  );
  assert.match(picker, /const isOnboarding = !isSettingsMode && !hasCompletedOnboarding;/);
  assert.doesNotMatch(picker, /completeOnboarding/);
});

test("Home map recentres only when the chosen building changes", () => {
  const map = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");

  assert.match(map, /centeredBuildingNameRef\.current === selectedBuilding\?\.name\) return;/);
  assert.match(map, /\}, \[selectedBuilding\?\.name\]\);/);
  assert.doesNotMatch(
    map,
    /\}, \[activeBuildingRecord\.coordinate\.latitude, activeBuildingRecord\.coordinate\.longitude\]\);/,
  );
});

test("Map is open to every diner from a List/Map toggle on Discover, guests included", () => {
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const map = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");
  const toggle = readRepoFile("src/components/discover/DiscoverViewToggle.tsx");
  const navigator = readRepoFile("src/app/navigation/RootNavigator.tsx");

  // No merchant/dev-only gate on the Discover map entry.
  assert.match(
    discover,
    /<DiscoverViewToggle\s+value="list"[\s\S]*?onChange=\{\(\) => navigation\.navigate\("DiscoverMap"\)\}/,
  );
  assert.doesNotMatch(
    discover,
    /\{isUserMode \? null : \(\s*<View style=\{\{ marginTop: -spacing\[0\.5\] \}\}>/,
  );
  assert.match(map, /<DiscoverViewToggle value="map" onChange=\{backToList\} \/>/);
  // List always returns to the Discover tab, even when the stack below the map is Home.
  const backToList =
    map.match(/const backToList = useCallback\([\s\S]*?\}, \[navigation\]\);/)?.[0] ?? "";
  assert.match(backToList, /navigation\.popTo\("MainTabs", \{ screen: "Discover" \}\)/);
  assert.doesNotMatch(backToList, /goBack\(\)/);
  assert.match(toggle, /accessibilityRole="tab"/);
  assert.match(toggle, /accessibilityState=\{\{ selected \}\}/);

  // DiscoverMap is not an auth-required route; guests see the map and its pins.
  const protectedRoutes = navigator.match(/const PROTECTED_ROOT_ROUTES[\s\S]*?\]\);/)?.[0] ?? "";
  assert.ok(protectedRoutes, "PROTECTED_ROOT_ROUTES should exist");
  assert.doesNotMatch(protectedRoutes, /"DiscoverMap"/);
  assert.doesNotMatch(map, /if \(!isAuthenticated\)/);
  assert.doesNotMatch(map, /GuestMapPrompt/);
});
