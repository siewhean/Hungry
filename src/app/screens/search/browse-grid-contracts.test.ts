import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Browse Stalls falls back to repository mock data before showing empty state", () => {
  const source = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(source, /dataRepositoryMock as fallbackBrowseRepository/);
  assert.match(source, /const fallbackAllVenues = useMemo/);
  assert.match(source, /repositoryVenues\.length \? repositoryVenues : fallbackAllVenues/);
  assert.match(source, /const getBrowseDishesByVenue = useCallback/);
  assert.match(source, /fallbackBrowseRepository\.listDishesByVenue\(venueId\)/);
  assert.match(source, /const getBrowseDishById = useCallback/);
  assert.match(source, /fallbackBrowseRepository\.getDishById\(dishId\)/);
  assert.match(source, /const buildStallItems =/);
  assert.match(source, /const stallItems = buildStallItems\(browseVenues\)/);
  assert.match(source, /if \(stallItems\.length\)/);
  assert.match(source, /return buildStallItems\(\s*fallbackAllVenues\.map/);
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
