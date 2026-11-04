// Picking an option from a search (a suggestion, a matched dish or stall, a place, an area) puts the
// keyboard away, so the next screen or the chosen row is not left behind it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("every option picked on the search home dismisses the keyboard", () => {
  const source = read("src/app/screens/search/DishSearchScreen.tsx");
  for (const handler of ["openResults", "openSuggestion", "openMatchedDish", "openMatchedStall"]) {
    assert.match(
      source,
      new RegExp(`const ${handler} = \\([^)]*\\) => \\{\\s*Keyboard\\.dismiss\\(\\);`),
      `${handler} dismisses the keyboard`,
    );
  }
});

test("picking a place in the search results, or an area in the area search, dismisses the keyboard", () => {
  assert.match(
    read("src/app/screens/search/SearchResultsScreen.tsx"),
    /\(next: BrowsePlace\) => \{\s*Keyboard\.dismiss\(\);/,
  );
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  assert.match(
    picker,
    /const choose = \(result: AreaSearchResult\) => \{\s*Keyboard\.dismiss\(\);/,
  );
  assert.match(picker, /const chooseCurrentLocation = async \(\) => \{\s*Keyboard\.dismiss\(\);/);
});
