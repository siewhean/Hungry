import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("dish page: Order on under the stall card, rating only after Tried, no flavour tags", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallCard = dish.indexOf("stall details`}");
  const orderOn = dish.search(/Order on\s*<\/AppText>/);
  const radar = dish.indexOf("<DishTasteCard");
  assert.ok(stallCard > 0 && orderOn > stallCard && radar > orderOn);
  // No rating before the dish is tried; marking it tried opens an optional rate + taste popup.
  assert.doesNotMatch(dish, /Rate this dish/);
  // The popup lives in TriedFollowUp (dish_tried_prompt_v1), mounted only after a Tried mark.
  const followUp = read("src/features/detail/TriedFollowUp.tsx");
  assert.match(dish, /"Marked as tried\."[\s\S]*?setTriedFollowUpPending\(true\)/);
  assert.match(followUp, /<StarRating value=\{rating\} editable onChange=\{setRating\}/);
  assert.match(followUp, /How did it taste\?[\s\S]*?<TasteRatingInput/);
  assert.match(followUp, /label="Not now"/);
  // Not tried: grey circle, no tick. Tried: orange tick.
  assert.match(
    dish,
    /icon: isDishTried \? CheckCircle : Circle,\s+active: isDishTried,\s+mutedWhenInactive: true/,
  );
  assert.doesNotMatch(dish, /dish\.tasteTags/);
  assert.match(dish, /<DietaryFlagChips flags=\{dish\.dietaryFlags\}/);
  // The review's stars sit under the author; the like and the "..." share the card's actions.
  const reviewCard = read("src/components/dish/DishReviewCard.tsx");
  assert.match(reviewCard, /<ReviewStars/);
  assert.match(reviewCard, /<ReviewReaderActions/);
});

test("radar: reviews in grey, how it tastes to the diner in orange on top", () => {
  const chart = read("src/components/taste/TasteRadarChart.tsx");
  assert.match(
    chart,
    /points=\{shape\(\(axis\) => axis\.standard\)\}\s+fill=\{palette\.textSecondary\}/,
  );
  assert.match(
    chart,
    /points=\{shape\(\(axis\) => axis\.yours \?\? 0\)\}\s+fill=\{palette\.orange\}/,
  );
  const taste = read("src/features/detail/perceivedTaste.ts");
  assert.match(taste, /yours: perceivedTasteLevel\(standard, userVector\[dimension\.key\]\)/);
});

test("rating stars are yellow", () => {
  const tokens = read("src/theme/tokens.ts");
  assert.match(tokens, /starFill: "#FFC21A"/);
  for (const path of [
    "src/components/review/StarRating.tsx",
    "src/components/review/ReviewReaderActions.tsx",
  ]) {
    assert.match(read(path), /palette\.starFill/);
    assert.doesNotMatch(read(path), /fill=\{[^}]*palette\.(amber|ratingStar)/);
  }
});

test("bottom bar: no three dots, holding an icon never dims the page", () => {
  const bar = read("src/components/detail/DetailActionBar.tsx");
  assert.doesNotMatch(bar, /MoreHorizontal|More actions/);
  assert.doesNotMatch(bar, /mediaScrim|dimmed page/);
  assert.match(bar, /accessibilityLabel="Close menu"/);
});

test("stall page: description only, hours on one row, website, filter beside the heading", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.doesNotMatch(stall, /From the owner|All hours|\{dishes\.length\} items/);
  assert.match(stall, /link\.platform === "website"/);
  assert.match(
    stall,
    /"h2">Menu<\/AppText>\s+\{menuStatus === "ready" &&[\s\S]*?<MenuFilterDropdown/,
  );
  const card = stall.indexOf("Opening hours, ${operatingStatusLabel}");
  const orderOn = stall.search(/Order on\s*<\/AppText>/);
  const menu = stall.indexOf("{/* Menu */}");
  assert.ok(card > 0 && orderOn > card && menu > orderOn);
});

test("area search: animated placeholder and a results list with no map", () => {
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  assert.match(picker, /placeholder=\{movingPlaceholder\}/);
  // The Singapore map is gone: the area follows the phone, the search is for people without it.
  assert.doesNotMatch(picker, /SingaporeAreaMap|onAreaPress|onPlacePress|mapBox|optionsOpen/);
  assert.match(picker, /<ScrollView[\s\S]*?title="Use my current location"/);
  assert.match(picker, /<Button label="Set as my location" disabled=\{!selected\}/);
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(search, /enableMovingPlaceholder\s+movingPlaceholderPhrases=/);
});
