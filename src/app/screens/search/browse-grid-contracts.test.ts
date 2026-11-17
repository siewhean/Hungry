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
  assert.match(source, /<ActivityIndicator color=\{palette\.orange\}/);
  assert.match(
    source,
    /const loadingLabel = mode === "dishes" \? "Preparing dishes" : "Preparing stalls"/,
  );
  assert.match(source, /accessibilityLabel=\{loadingLabel\}/);
  assert.match(source, /if \(!browseIndex \|\| shouldUseQueryScopedFeed\)/);
  assert.match(source, /const queryMatchedDishes = useMemo/);
  assert.match(source, /searchBrowseDishes\(browseIndex/);
  assert.match(source, /const buildStallItems =/);
  assert.match(
    source,
    /import \{ dedupeNearestVenueCandidates \} from "@\/features\/search\/venueDedupe"/,
  );
  assert.match(
    source,
    /return dedupeNearestVenueCandidates\([\s\S]*buildStallItems\(browseVenues\)/,
  );
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

test("image grids retain one dish identity through image failures and gestures", () => {
  const cyclingImage = read("src/components/discover/CyclingGridImage.tsx");
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
  const browseGrid = read("src/app/screens/search/SearchResultsScreen.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(cyclingImage, /isAutoCycleActive = false/);
  assert.match(cyclingImage, /originalIndex/);
  assert.match(quickBites, /const activeSlide = item;/);
  assert.match(quickBites, /images=\{\[cycleFrames\[0\]\?\.imageUrl \?\? item\.photoUrl\]\}/);
  assert.match(browseGrid, /const activeSlide = item;/);
  assert.match(browseGrid, /images=\{\[item\.imageUrl\]\}/);
  assert.match(stallDetail, /const activeDish = dish;/);
  assert.match(stallDetail, /images=\{\[dish\.imageUrl\]\}/);
  assert.match(stallDetail, /<StallMenuDishCard/);
});
