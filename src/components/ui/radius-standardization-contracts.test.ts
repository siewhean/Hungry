import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("UI radius contract: shared cards, buttons, inputs, chips, and search use componentRadii", () => {
  const tokens = read("src/theme/tokens.ts");
  const theme = read("src/theme/index.tsx");
  const button = read("src/components/ui/Button.tsx");
  const card = read("src/components/ui/Card.tsx");
  const input = read("src/components/ui/Input.tsx");
  const iconButton = read("src/components/ui/IconButton.tsx");
  const chip = read("src/components/ui/Chip.tsx");
  const expandableSearch = read("src/components/ui/ExpandableSearchLauncher.tsx");

  assert.match(tokens, /export const componentRadii = \{/);
  assert.match(tokens, /card: radii\.lg/);
  assert.match(tokens, /button: radii\.lg/);
  assert.match(tokens, /input: radii\.lg/);
  assert.match(tokens, /search: radii\.lg/);
  assert.match(tokens, /iconButton: radii\.lg/);
  assert.match(tokens, /export const componentCornerCurve = \{/);
  assert.match(tokens, /borderCurve: "continuous"/);
  assert.match(theme, /componentRadii: typeof componentRadii/);
  assert.match(theme, /componentCornerCurve: typeof componentCornerCurve/);
  assert.match(theme, /componentRadii,/);
  assert.match(theme, /componentCornerCurve,/);

  assert.match(button, /borderRadius: componentRadii\.button/);
  assert.match(button, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.match(card, /borderRadius: componentRadii\.card/);
  assert.match(card, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.match(input, /borderRadius: componentRadii\.input/);
  assert.match(input, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.match(iconButton, /borderRadius: componentRadii\.iconButton/);
  assert.match(iconButton, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.match(chip, /borderRadius: componentRadii\.button/);
  assert.match(chip, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.match(expandableSearch, /borderRadius: componentRadii\.iconButton/);
  assert.match(expandableSearch, /borderRadius: componentRadii\.search/);
  assert.match(expandableSearch, /borderCurve: componentCornerCurve\.borderCurve/);

  for (const source of [button, card, input, iconButton, chip, expandableSearch]) {
    assert.doesNotMatch(source, /borderRadius: radii\.(lg|xl|pill)/);
    assert.doesNotMatch(source, /resolvedBarHeight \/ 2/);
    assert.doesNotMatch(source, /Math\.min\(radii\.pill/);
  }
});

test("UI radius contract: high-traffic app surfaces consume componentRadii", () => {
  const surfaces = [
    "src/app/screens/discover/DiscoverHomeScreen.tsx",
    "src/app/screens/home/HomeFeedScreen.tsx",
    "src/app/screens/search/SearchResultsScreen.tsx",
    "src/app/screens/profile/ProfileHomeScreen.tsx",
    "src/features/post/components/PostTab.tsx",
    "src/features/post/components/MediaManager.tsx",
    "src/components/social/BiteCard.tsx",
    "src/components/collections/CollectionCard.tsx",
    "src/app/screens/merchant/MerchantDashboardScreen.tsx",
    "src/app/screens/merchant/MerchantMenuScreen.tsx",
  ];

  for (const surface of surfaces) {
    assert.match(read(surface), /componentRadii/);
  }
});
