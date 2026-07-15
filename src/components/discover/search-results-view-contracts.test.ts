import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/components/discover/SearchResultsView.tsx"),
  "utf8",
);

test("search results keep the FDO search and back controls visible", () => {
  assert.match(source, /accessibilityLabel="Go back"/);
  assert.match(source, /accessibilityLabel="Search results"/);
  assert.doesNotMatch(source, /searchRevealProgress|isSearchExpanded|searchEntryWidth/);
});

test("search result cards expose the same truthful values as Discover", () => {
  assert.match(source, /getEffectiveCuisineTags\(dish\)/);
  assert.match(source, /formatDiscoverDistance\(dish\.distanceMeters\)/);
  assert.match(source, /formatDiscoverPrice\(dish\)/);
  assert.match(source, /\{dish\.venueName\}/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /onError=\{showRemoteImage \? \(\) => setRemoteImageFailed\(true\)/);
  assert.doesNotMatch(source, /S\$\{dish\.price\.toFixed\(2\)\}/);
});
