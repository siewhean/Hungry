import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function readFilesUnder(relativePath: string): string {
  const base = path.join(root, relativePath);
  const files: string[] = [];

  function collect(currentPath: string) {
    const stat = statSync(currentPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(currentPath)) {
        collect(path.join(currentPath, entry));
      }
      return;
    }
    if (currentPath.endsWith(".ts") || currentPath.endsWith(".tsx")) {
      files.push(readFileSync(currentPath, "utf8"));
    }
  }

  collect(base);
  return files.join("\n");
}

test("Screen header contract: shared app headers use one fixed title treatment", () => {
  const source = read("src/components/ui/AppHeader.tsx");
  const screenSource = read("src/components/ui/Screen.tsx");

  assert.match(screenSource, /<AppHeader/);
  assert.match(source, /fontSize: 24/);
  assert.match(source, /lineHeight: 30/);
  assert.match(source, /fontWeight: "900"/);
  assert.match(source, /minHeight: 56/);
  assert.doesNotMatch(screenSource, /paddingLeft: scrollBackVisible/);
  assert.doesNotMatch(screenSource, /paddingTop: scrollBackVisible/);
});

test("Screen header contract: V2 Discover, Review, and New Post headers use AppHeader", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const discoverV2 = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const reviews = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewsV2 = read("src/app/screens/review/ReviewFeedScreenV2.tsx");
  const composerHeader = read("src/features/post/components/ComposerHeader.tsx");

  assert.match(discover, /YOU ARE AT/);
  assert.doesNotMatch(discover, /<AppHeader[\s\S]*title="Discover"/);
  assert.match(discoverV2, /<AppHeader[\s\S]*title="Discover"/);
  assert.match(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverHomeScreen\}/);
  assert.doesNotMatch(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverHomeScreenV2\}/);
  assert.match(reviews, /<AppHeader[\s\S]*title="Reviews"/);
  assert.match(reviewsV2, /<AppHeader[\s\S]*title="Reviews"/);
  assert.match(composerHeader, /<AppHeader[\s\S]*title=\{title\}/);
  assert.doesNotMatch(composerHeader, /fontSize: 16/);
});

test("Discover V1 contract: situation intents live in their matching sections", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const discoverSources = readFilesUnder("src/app/screens/discover");

  assert.match(discover, /const POPULAR_FOOD_STYLES: readonly PopularFoodStyle\[\] = \[/);
  assert.match(discover, /function FoodStyleButton/);
  assert.doesNotMatch(discoverSources, /Find something for\.\.\./);
  assert.doesNotMatch(discoverSources, /function SituationTile/);
  assert.match(discover, /Quick Bites[\s\S]*&lt; 15 MIN[\s\S]*navigation\.navigate\("QuickBites"\)/);
  assert.match(discover, /Budget &lt; S\$8[\s\S]*VALUE[\s\S]*filter\(\(d\) => d\.price < 8\)/);
  assert.match(discover, /Late Night Makan[\s\S]*LATE NIGHT[\s\S]*key=\{`night-\$\{dish\.id\}`\}/);
  assert.doesNotMatch(discover, /new Date\(\)\.getHours\(\) >= 22/);
  assert.match(discover, /<Image[\s\S]*source=\{\{ uri: imageUrl \}\}[\s\S]*contentFit="contain"/);
  assert.match(discover, /overflow: "hidden"/);
  assert.match(discover, /handleFoodStylePress\(item\.query\)/);
  assert.match(discover, /updateSearchQuery\(query\)/);
  assert.match(discover, /navigation\.navigate\("SearchResults"\)/);
  assert.match(discover, /places in this area/);
  assert.match(discover, /Trending in \{discoverLocationLabel\}/);
  assert.match(discover, /Stalls in \{discoverLocationLabel\}/);
  assert.doesNotMatch(discover, /discoverNearbyCount/);
});

test("Discover V1 contract: browse cards open grid mode instead of generic search", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");
  const searchResults = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(discover, /function DiscoveryTargetGridPreview/);
  assert.match(discover, /<DiscoveryTargetGridPreview fallbackLabel="Stall" imageUrls=\{stallPreviewImages\}/);
  assert.match(discover, /<DiscoveryTargetGridPreview fallbackLabel="Dish" imageUrls=\{dishPreviewImages\}/);
  assert.doesNotMatch(discover, />🏪</);
  assert.doesNotMatch(discover, />🍜</);
  assert.match(discover, /const previewSlots = \[0, 1, 2, 3, 4, 5, 6, 7, 8\]/);
  assert.match(discover, /navigation\.navigate\("BrowseStalls"\)/);
  assert.match(discover, /navigation\.navigate\("BrowseDishes"\)/);
  assert.match(navigationTypes, /SearchResults: \{ browseMode\?: "dishes" \| "stalls" \} \| undefined/);
  assert.match(navigationTypes, /BrowseDishes: undefined/);
  assert.match(navigationTypes, /BrowseStalls: undefined/);
  assert.match(searchResults, /export function BrowseDishesScreen/);
  assert.match(searchResults, /export function BrowseStallsScreen/);
  assert.match(searchResults, /const areaLabel = manualLocation \?\? areaBuildings\[0\]\?\.name \?\? "Current area"/);
  assert.match(searchResults, /Dishes in \$\{areaLabel\}/);
  assert.match(searchResults, /Stalls & restaurants in \$\{areaLabel\}/);
  assert.match(searchResults, /const browseMode = route\.params\?\.browseMode/);
  assert.doesNotMatch(searchResults, /Dishes nearby/);
  assert.doesNotMatch(searchResults, /Stalls & restaurants nearby/);
  assert.match(searchResults, /flexWrap: "wrap"/);
});
