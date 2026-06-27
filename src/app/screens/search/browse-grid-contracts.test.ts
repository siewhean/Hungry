import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Browse Stalls uses the active repository before showing empty state", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.doesNotMatch(source, /dataRepositoryMock as fallbackBrowseRepository/);
  assert.doesNotMatch(source, /const fallbackAllVenues = useMemo/);
  assert.match(source, /getCachedBrowseIndex\(repository\)/);
  assert.match(source, /setBrowseIndex\(getBrowseIndex\(repository\)\)/);
  assert.match(source, /browseIndex\.sortedDishesByVenueId\.get\(venue\.id\)/);
  assert.match(source, /browseIndex\.dishById\.get\(venue\.topDishId\)/);
  assert.match(source, /const BROWSE_GRID_HYDRATION_TIMEOUT_MS = 350/);
  assert.match(source, /scheduleIdleWork/);
  assert.match(source, /if \(!browseIndex \|\| shouldUseQueryScopedFeed\)/);
  assert.match(source, /const queryMatchedDishes = useMemo/);
  assert.match(source, /searchBrowseDishes\(browseIndex/);
  assert.match(source, /const buildStallItems =/);
  assert.match(source, /return buildStallItems\(browseVenues\)/);
  assert.match(source, /export function BrowseStallsScreen\(\)/);
  assert.match(source, /return <BrowseGridScreen mode="stalls" \/>/);
});

test("Browse image-grid cards use the same dish image and destination as dish detail", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(source, /title: dish\.name,[\s\S]*imageUrl: dish\.imageUrl/);
  assert.match(source, /title: topDish\.name,[\s\S]*imageUrl: topDish\.imageUrl/);
  assert.match(source, /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dish\.id \}\)/);
  assert.doesNotMatch(source, /imageUrl: post\?\.mediaUrl/);
  assert.doesNotMatch(source, /navigation\.navigate\("StallDetail"/);
});

test("Two-column image grids cycle images every four seconds with page-scoped slide sets", () => {
  const cyclingImage = read("src/components/discover/CyclingGridImage.tsx");
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
  const browseGrid = read("src/app/screens/search/SearchResultsScreen.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(cyclingImage, /const DEFAULT_CYCLE_MS = 4000/);
  assert.match(cyclingImage, /<ScrollView[\s\S]*horizontal[\s\S]*pagingEnabled/);
  assert.match(cyclingImage, /scrollRef\.current\?\.scrollTo/);
  assert.match(cyclingImage, /const onActiveIndexChangeRef = useRef\(onActiveIndexChange\)/);
  assert.match(cyclingImage, /onActiveIndexChangeRef\.current = onActiveIndexChange/);
  assert.match(cyclingImage, /onActiveIndexChangeRef\.current\?\.\(normalizedIndex\)/);
  assert.match(cyclingImage, /measureInWindow/);
  assert.match(cyclingImage, /isFullyVisible/);
  assert.match(cyclingImage, /onMomentumScrollEnd=\{handleScrollEnd\}/);
  assert.match(cyclingImage, /onScrollBeginDrag=\{handleScrollBeginDrag\}/);
  assert.match(cyclingImage, /onScrollEndDrag=\{handleScrollEndDrag\}/);

  assert.match(quickBites, /getQuickBiteCycleSlides/);
  assert.match(quickBites, /candidate\.venueId !== item\.venueId/);
  assert.match(quickBites, /itemVisiblePercentThreshold: 100/);
  assert.match(quickBites, /fullyVisibleBiteIds\.has\(item\.id\)/);
  assert.match(
    quickBites,
    /<CyclingGridImage[\s\S]*cycleMs=\{CYCLING_GRID_IMAGE_INTERVAL_MS\}[\s\S]*isAutoCycleActive=\{isAutoCycleActive\}/,
  );
  assert.match(
    quickBites,
    /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dishId \}\)/,
  );

  assert.match(browseGrid, /getCrossStallBrowseSlides/);
  assert.match(browseGrid, /candidate\.dish\.venueId !== item\.dish\.venueId/);
  assert.match(browseGrid, /getStallBrowseSlides/);
  assert.match(browseGrid, /itemVisiblePercentThreshold: 100/);
  assert.match(browseGrid, /fullyVisibleFeedItemIds\.has\(item\.id\)/);
  assert.match(browseGrid, /browseIndex\?\.sortedDishesByVenueId\.get\(item\.venue\.id\)/);
  assert.match(
    browseGrid,
    /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dish\.id \}\)/,
  );

  assert.match(stallDetail, /getStallDishCycleSlides/);
  assert.match(stallDetail, /<StallMenuDishCard/);
  assert.match(stallDetail, /navigation\.navigate\("DishDetail", \{ dishId: activeDish\.id \}\)/);
});
