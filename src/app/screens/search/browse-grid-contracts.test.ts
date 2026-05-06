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
  assert.match(source, /const getBrowseDishesByVenue = useCallback/);
  assert.match(source, /repository\.listDishesByVenue\(venueId\)/);
  assert.match(source, /const getBrowseDishById = useCallback/);
  assert.match(source, /repository\.getDishById\(dishId\)/);
  assert.match(source, /const buildStallItems =/);
  assert.match(source, /return buildStallItems\(browseVenues\)/);
  assert.match(source, /export function BrowseStallsScreen\(\)/);
  assert.match(source, /return <BrowseGridScreen mode="stalls" \/>/);
});

test("Browse image-grid cards use the same dish image and destination as dish detail", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(source, /title: dish\.name,[\s\S]*imageUrl: dish\.imageUrl/);
  assert.match(source, /title: topDish\.name,[\s\S]*imageUrl: topDish\.imageUrl/);
  assert.match(source, /navigation\.navigate\("DishDetail", \{ dishId: item\.dish\.id \}\)/);
  assert.doesNotMatch(source, /imageUrl: post\?\.mediaUrl/);
  assert.doesNotMatch(source, /navigation\.navigate\("StallDetail"/);
});
