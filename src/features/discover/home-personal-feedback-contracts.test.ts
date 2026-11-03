// Home's "Not for me" / "Show less" wiring, as source contracts: the screen files are large and
// render-tested elsewhere, so these pin the pieces that are easy to lose in a refactor.
import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const HOME = "src/app/screens/discover/DiscoverHomeScreen.tsx";
const RAIL = "src/components/discover/home/DiscoverBiteRail.tsx";

test("every Home rail gets the card options handler", () => {
  const home = readRepoFile(HOME);
  assert.match(home, /onBiteOptions: openBiteOptions/);
  assert.equal(
    (home.match(/<DiscoverBiteRail/g) ?? []).length,
    (home.match(/\{\.\.\.discoverRailProps\}/g) ?? []).length,
    "each DiscoverBiteRail spreads discoverRailProps",
  );
});

test("Not for me records a dismissed taste interaction and confirms with a toast", () => {
  const home = readRepoFile(HOME);
  assert.match(home, /type: "dismissed"/);
  assert.match(home, /buttonId: "home_not_for_me"/);
  assert.match(home, /showToast\(\{ message: `Hidden\./);
});

test("hidden dishes and muted food types are applied to every rail's source collections", () => {
  const home = readRepoFile(HOME);
  assert.match(home, /buildFoodHistory\(foodHistoryRows\)\.dismissedDishIds/);
  assert.match(home, /applyFeedbackToBites\(allBiteCollections\./);
  assert.match(home, /dismissedDishIds\.has\(dish\.id\)/, "mall mode drops hidden dishes too");
});

test("the palate Home ranks by includes this visit's shift, and the match needs a trusted profile", () => {
  const home = readRepoFile(HOME);
  assert.match(home, /applySessionShift\(/);
  assert.match(home, /tasteVector: rankingTasteVector/);
  assert.match(home, /profileTrusted: hasTasteProfile/);
});

test("the card opens its options on long press and offers a screen reader action", () => {
  const rail = readRepoFile(RAIL);
  assert.match(rail, /onLongPress=\{onOptions \? handleOptions : undefined\}/);
  assert.match(rail, /accessibilityActions=/);
  assert.match(rail, /onAccessibilityAction=/);
});

test("the card also shows a visible more-options button, so the long press is not the only way", () => {
  const rail = readRepoFile(RAIL);
  assert.match(rail, /More options for \$\{bite\.dishName\}/);
  assert.match(rail, /onPress=\{handleOptions\}/);
});

test("the rail impression event lists the dish ids in on-screen order", () => {
  const rail = readRepoFile(RAIL);
  assert.match(rail, /dish_ids: cards\.map\(\(card\) => card\.dishId\)/);
});
