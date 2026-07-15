import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRoot), "utf8");
}

test("Crave cards recover from missing or failed catalog images and expose truthful values", () => {
  const source = read("src/app/screens/discover/CraveScreen.tsx");

  assert.match(source, /isUsableDiscoverImageUrl\(dish\.imageUrl\)/);
  assert.match(source, /getDishFallbackImageSource\(dish\)/);
  assert.match(source, /onError=\{showRemoteImage \? \(\) => setRemoteImageFailed\(true\)/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /getEffectiveCuisineTags\(currentDish\)/);
  assert.match(source, /formatDiscoverDistance\(currentDish\.distanceMeters\)/);
  assert.match(source, /formatDiscoverPrice\(currentDish\)/);
  assert.match(source, /const panResponder = useMemo\(/);
  assert.match(source, /\[position, swipeLeft, swipeRight\]/);
  assert.match(source, /saveCurrentCraveDish\(currentDish, toggleFavourite\)/);
  assert.doesNotMatch(source, /source=\{\{ uri: (?:currentDish|nextDish)\.imageUrl \}\}/);
});

test("Home Map dish cards keep catalog media recoverable and do not round source prices", () => {
  const source = read("src/app/screens/discover/HomeMapScreen.tsx");

  assert.match(source, /isUsableDiscoverImageUrl\(dish\.imageUrl\)/);
  assert.match(source, /getDishFallbackImageSource\(dish\)/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /getEffectiveCuisineTags\(dish\)/);
  assert.match(source, /formatDiscoverDistance\(dish\.distanceMeters\)/);
  assert.match(source, /formatDiscoverPrice\(dish\)/);
  assert.doesNotMatch(source, /S\$\{Math\.round\(dish\.price\)\}/);
  assert.doesNotMatch(source, /source=\{\{ uri: dish\.imageUrl \}\}/);
  assert.match(source, /mapLoadStatus === "loading"/);
  assert.match(source, /mapLoadStatus === "error"/);
  assert.match(source, /title="No nearby stalls or dishes"/);
  assert.match(source, /accessibilityRole="progressbar"/);
});

test("Dish Search cards cycle usable source media before labelled representative images", () => {
  const source = read("src/app/screens/search/DishSearchScreen.tsx");

  assert.match(source, /getDishImageCandidates\(dish\)/);
  assert.match(source, /isUsableDiscoverImageUrl\(imageUrl\)/);
  assert.match(source, /getDishFallbackImageSource\(\{/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /getEffectiveCuisineTags\(suggestedDish\)/);
  assert.match(source, /formatDiscoverDistance\(suggestedDish\.distanceMeters\)/);
  assert.match(source, /formatDiscoverPrice\(suggestedDish\)/);
  assert.match(source, /formatDiscoverPrice\(topDish\)/);
  assert.doesNotMatch(source, /Best match within 2km/);
  assert.doesNotMatch(source, /source=\{\{ uri: suggestedDish\?\.imageUrl \}\}/);
  assert.doesNotMatch(source, /source=\{\{ uri: collection\.posts\[0\]\?\.mediaUrl \}\}/);
  assert.match(source, /isSupabaseDataSource\s+\? \[\]\s+: getDiscoverStallCollections/);
  assert.match(source, /\.listDiscoveryFeedByLocation\(\{/);
  assert.match(source, /buildBoundedDiscoverStallCollections\(scopedFeed, filters\.query, 4\)/);
  assert.match(source, /title="Suggestions unavailable"/);
  assert.match(source, /title="No nearby suggestions"/);
});
