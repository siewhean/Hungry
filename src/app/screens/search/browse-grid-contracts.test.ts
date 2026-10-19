import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Browse Dishes and Stalls page the active catalog service with a loading state", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(source, /const service = getCatalogRawService\(\)/);
  assert.match(source, /export function BrowseStallsScreen\(\)/);
  assert.match(source, /return <RawCatalogBrowseGrid mode="stalls" \/>/);
  assert.match(source, /return <RawCatalogBrowseGrid mode="dishes" \/>/);
  assert.match(source, /<ActivityIndicator color=\{palette\.orange\}/);
  assert.match(
    source,
    /const loadingLabel = mode === "dishes" \? "Preparing dishes" : "Preparing stalls"/,
  );
  assert.match(source, /accessibilityLabel=\{loadingLabel\}/);
  assert.match(
    source,
    /onEndReached=\{\(\) => \{\s*if \(nextCursor && !isLoadingMore && !isLoading && !loadMoreFailed\)/,
  );
});

test("Browse grid cards open the matching catalog record", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(
    source,
    /navigation\.navigate\("CatalogRawDetail", \{\s*kind: mode === "dishes" \? "dish" : "venue",\s*id: item\.id,/,
  );
  assert.match(source, /item\.imageUrl \?\? \("representativeDish" in item/);
});

test("Two-column image grids cycle images every four seconds with page-scoped slide sets", () => {
  const cyclingImage = read("src/components/discover/CyclingGridImage.tsx");
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
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

  assert.match(stallDetail, /getStallDishPhotos/);
  assert.match(stallDetail, /\[dish\.imageUrl, \.\.\.\(dish\.gallery \?\? \[\]\)\]/);
  assert.doesNotMatch(
    stallDetail,
    /getStallDishCycleSlides|activeDish\.name|dishes=\{filteredMenuDishes\}/,
  );
  assert.match(stallDetail, /onPress=\{\(\) => onPress\(dish\)\}/);
  assert.match(stallDetail, /<NoDishPhoto dishName=\{dish\.name\}/);
  assert.match(stallDetail, /<StallMenuDishCard/);
  assert.match(stallDetail, /navigation\.navigate\("DishDetail", \{ dishId: activeDish\.id \}\)/);
});
