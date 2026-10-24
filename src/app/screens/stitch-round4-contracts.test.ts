import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("dish page: Order on sits under the stall card, quick rate, no flavour tags", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallCard = dish.indexOf("stall details`}");
  const orderOn = dish.indexOf("ORDER ON");
  const radar = dish.indexOf("<TasteRadarChart");
  assert.ok(stallCard > 0 && orderOn > stallCard && radar > orderOn);
  assert.match(
    dish,
    /Rate this dish[\s\S]*?<StarRating value=\{0\} editable onChange=\{startRating\}/,
  );
  assert.match(dish, /setReviewRating\(rating\)/);
  assert.doesNotMatch(dish, /dish\.tasteTags/);
  assert.match(dish, /<DietaryFlagChips flags=\{dish\.dietaryFlags\}/);
  // The review's stars and its like share the card's last line.
  assert.match(dish, /<ReviewReaderActions\s+key=\{review\.id\}\s+rating=\{review\.rating\}/);
});

test("radar: reviews in grey, the diner's palette in orange", () => {
  const chart = read("src/components/taste/TasteRadarChart.tsx");
  assert.match(
    chart,
    /points=\{shape\(\(axis\) => axis\.standard\)\}\s+fill=\{palette\.textSecondary\}/,
  );
  assert.match(
    chart,
    /points=\{shape\(\(axis\) => axis\.yours \?\? 0\)\}\s+fill=\{palette\.orange\}/,
  );
});

test("bottom bar: no three dots, held button stays lit over a dimmed page", () => {
  const bar = read("src/components/detail/DetailActionBar.tsx");
  assert.doesNotMatch(bar, /MoreHorizontal|More actions/);
  assert.match(
    bar,
    /backgroundColor: palette\.mediaScrim, elevation: OVERLAY_Z, zIndex: OVERLAY_Z/,
  );
  assert.match(bar, /The held button stays lit above the dimmed page/);
});

test("stall page: description only, hours on one row, website, filter beside the heading", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.doesNotMatch(stall, /From the owner|All hours|\{dishes\.length\} items/);
  assert.match(stall, /link\.platform === "website"/);
  assert.match(
    stall,
    /Signature Dishes<\/AppText>\s+\{menuStatus === "ready" &&[\s\S]*?<MenuFilterDropdown/,
  );
  const card = stall.indexOf("Opening hours, ${operatingStatusLabel}");
  const orderOn = stall.indexOf("ORDER ON");
  const menu = stall.indexOf("{/* Menu */}");
  assert.ok(card > 0 && orderOn > card && menu > orderOn);
});

test("area search: animated placeholder and a map you can tap and zoom", () => {
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  assert.match(picker, /placeholder=\{movingPlaceholder\}/);
  assert.match(picker, /onAreaPress=\{/);
  assert.match(picker, /onPlacePress=\{/);
  assert.match(picker, /listPlaces\(\{ coordinate: center, radiusMeters, limit: 20 \}\)/);
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(search, /enableMovingPlaceholder\s+movingPlaceholderPhrases=/);
});
