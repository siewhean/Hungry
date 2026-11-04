// Source contracts for the round-five dish page (DISH5-*): things a render test in jsdom cannot see
// (fonts, native motion, the system symbol names).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { EXPERIMENTS } from "@/lib/experiments/experiments";

const read = (path: string) => readFileSync(path, "utf8");
const screen = read("src/app/screens/detail/DishDetailScreenV2.tsx");
const bar = read("src/components/detail/DetailActionBar.tsx");
const back = read("src/components/detail/FloatingBackButton.tsx");
const symbols = read("src/components/dish/dishSymbols.tsx");
const saveSheet = read("src/features/checklistPortfolio/DetailSaveActions.tsx");

test("DISH5-9: the dish page prices use the body font with tabular digits, not DM Mono", () => {
  assert.match(
    screen,
    /DISH_PRICE_FONT: TextStyle = \{ fontFamily: "Nunito_700Bold", fontVariant: \["tabular-nums"\] \}/,
  );
  const uses = screen.match(/variant="price"/g) ?? [];
  const overridden = screen.match(/DISH_PRICE_FONT/g) ?? [];
  // One declaration, then one use beside each price.
  assert.ok(overridden.length - 1 >= uses.length, "every price text carries the override");
});

test("DISH5-3: the dish page draws no Lucide icon and no text star", () => {
  assert.doesNotMatch(screen, /lucide-react-native/);
  assert.equal(screen.includes("★"), false);
  assert.match(screen, /shareIcon=\{ShareSymbol\}/);
  assert.match(screen, /backIcon=\{BackSymbol\}/);
});

test("DISH5-3: the dish symbols use the system names the audit asked for", () => {
  for (const name of [
    "chevron.backward",
    "square.and.arrow.up",
    "circle",
    "checkmark.circle.fill",
    "bookmark.fill",
    "folder.badge.plus",
    "mappin.and.ellipse",
    "chevron.forward",
    "star.fill",
    "ellipsis",
    "hand.thumbsup.fill",
    "flag",
    "arrow.up.forward.app",
    "xmark",
    "plus",
    "checkmark",
    "square.dashed",
  ]) {
    assert.ok(symbols.includes(`"${name}"`), `${name} is used`);
  }
});

test("DISH5-1: the hero passes a fallback so a failed photo never leaves a blank block", () => {
  assert.match(screen, /fallback=\{<DishHeroPlaceholder/);
});

test("DISH5-5: the Save sheet has a Done button and an enabled-by-text primary Create button", () => {
  assert.match(saveSheet, /label="Done"/);
  assert.match(saveSheet, /sheetRef\.current\?\.dismiss\(\)/);
  const create = saveSheet.slice(saveSheet.indexOf('label="Create and add"'));
  assert.doesNotMatch(create.slice(0, 200), /variant="secondary"/);
  assert.match(create.slice(0, 400), /disabled=\{!newListName\.trim\(\)/);
});

test("DISH5-6: the hold menu springs with Reanimated and honours Reduce Motion; presses scale to 0.97", () => {
  assert.match(bar, /from "react-native-reanimated"/);
  assert.match(bar, /duration: 300, dampingRatio: 0\.8/);
  assert.match(bar, /reduceMotion: ReduceMotion\.System/);
  assert.match(bar, /useReduceMotion\(\)/);
  assert.match(bar, /transformOrigin: "right bottom"/);
  assert.match(bar, /\[0\.95, 1\]/);
  assert.doesNotMatch(bar, /Animated\.spring|scale: pressed \? 0\.9 :/);
  assert.match(bar, /PressableScale/);
  assert.match(back, /PressableScale/);
  assert.doesNotMatch(back, /0\.92/);
});

test("DISH5-10: the dish page asks for the darker call-to-action orange", () => {
  assert.match(screen, /highContrastCta/);
  assert.match(bar, /palette\.orangeControl/);
});

test("DISH5-4: the three-taste Tried popup is a draft experiment that falls back to all six", () => {
  const experiment = EXPERIMENTS.dish_tried_taste_axes_v1;
  assert.deepEqual([...experiment.variants], ["control", "top3"]);
  assert.equal(experiment.fallback, "control");
  assert.equal(experiment.status, "draft");
  assert.equal(experiment.surface, "dish");
  assert.equal(experiment.primaryMetric, "review_submitted");
  assert.ok(experiment.minSamplePerArm && experiment.minSamplePerArm > 0);
});

test("R1/R2: the reviews summary star is the same symbol and colour as the rating at the top", () => {
  const summary = read("src/components/dish/DishReviewSummary.tsx");
  assert.doesNotMatch(summary, /lucide-react-native/);
  assert.match(summary, /<RatingStarSymbol color=\{palette\.starStroke\}/);
});

test("R3: a dish with no photo gets a compact hero under the status bar", () => {
  assert.match(screen, /COMPACT_HERO_HEIGHT = 120/);
  assert.match(
    screen,
    /heroPhotos\.length > 0 \? heroPhotoHeight : insets\.top \+ COMPACT_HERO_HEIGHT/,
  );
});
