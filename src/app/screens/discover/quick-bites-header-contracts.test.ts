import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Quick Bites grid header uses a top-right search icon instead of an inline search bar", () => {
  const source = read("src/app/screens/discover/QuickBitesScreen.tsx");

  assert.match(source, /accessibilityLabel="Search dishes"/);
  assert.match(source, /ExpandableSearchLauncher/);
  assert.match(source, /onSubmit=\{submitSearch\}/);
  assert.match(source, /expandedWidth=\{searchBarWidth\}/);
  assert.doesNotMatch(source, /TextInput/);
  assert.doesNotMatch(source, /searchIconButton: /);
  assert.doesNotMatch(source, /setSearchQuery/);
  assert.doesNotMatch(source, /onPress=\{\(\) => navigation\.navigate\("SearchHome"\)\}/);
});
