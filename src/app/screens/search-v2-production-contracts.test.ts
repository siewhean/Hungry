import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("search V2 hides unsupported tabs and binds result badges to data", () => {
  const search = read("src/app/screens/search/DishSearchScreenV2.tsx");
  const resultsView = read("src/components/discover/SearchResultsView.tsx");

  assert.match(search, /const SEARCH_TABS = \["All", "Dishes", "Stalls"\] as const/);
  assert.doesNotMatch(search, /"Reads"/);
  assert.doesNotMatch(search, /80m/);
  assert.doesNotMatch(search, /312 reviews/);
  assert.match(search, /formatDistance\(dish\.distanceMeters\)/);
  assert.match(search, /dish\.reviewCount/);
  assert.match(search, /item\.venue\.verificationStatus === "verified"/);
  assert.match(resultsView, /type FilterTab = "All" \| "Dishes"/);
  assert.match(resultsView, /const TABS: FilterTab\[\] = \["All", "Dishes"\]/);
  assert.doesNotMatch(resultsView, /"Stalls"/);
  assert.doesNotMatch(resultsView, /"Reads"/);
});

test("search result surfaces show honest empty states", () => {
  const search = read("src/app/screens/search/DishSearchScreenV2.tsx");
  const resultsView = read("src/components/discover/SearchResultsView.tsx");

  assert.match(search, /const visibleCollections = useMemo/);
  assert.match(search, /visibleCollections\.length/);
  assert.doesNotMatch(search, /if \(!dish\) return null/);
  assert.match(resultsView, /ListEmptyComponent/);
  assert.match(resultsView, /No matches found/);
  assert.match(resultsView, /Try another dish or taste filter\./);
});
