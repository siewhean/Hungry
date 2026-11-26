import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Quick Bites header is the search header with Dishes and Stalls tabs", () => {
  const source = read("src/app/screens/discover/QuickBitesScreen.tsx");

  // A search field and back button like the Search page, then the two tabs.
  assert.match(source, /accessibilityLabel=\{`Search \$\{mode\}`\}/);
  assert.match(source, /onSubmitEditing=\{submitSearch\}/);
  assert.match(source, /<UnderlineTabs/);
  assert.match(source, /tabs=\{MODE_TABS\}/);
  assert.doesNotMatch(source, /ExpandableSearchLauncher/);
  assert.doesNotMatch(source, /setSearchQuery/);
  assert.doesNotMatch(source, /onPress=\{\(\) => navigation\.navigate\("SearchHome"\)\}/);
  // The cards are the shared picture card, so the Budget and Search pages look alike.
  assert.match(source, /<PhotoGridCard/);
});
