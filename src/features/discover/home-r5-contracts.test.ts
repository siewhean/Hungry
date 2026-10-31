// Round-five Home contracts: press feedback on every card, symbols instead of text glyphs and
// emoji, and the taste-tag symbol names resolving to real AppSymbol rows.
import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";
import { REVIEW_TASTE_TAG_META } from "@/types/domain";

const HOME_FILES = [
  "src/app/screens/discover/DiscoverHomeScreen.tsx",
  "src/app/screens/discover/QuickBitesScreen.tsx",
  "src/app/screens/discover/CatalogDiscoverHome.tsx",
  "src/components/discover/TrendingList.tsx",
  "src/components/discover/home/DiscoverBiteRail.tsx",
  "src/components/discover/home/PopularFoodStyleItem.tsx",
  "src/components/discover/home/VerticalStallShowcaseSection.tsx",
] as const;

const EMOJI = /\p{Extended_Pictographic}/u;

test("Home draws no text star and no emoji: ratings use the star symbol", () => {
  for (const file of HOME_FILES) {
    const source = readRepoFile(file);
    assert.doesNotMatch(source, /★/, `${file} has a text star`);
    assert.doesNotMatch(source, EMOJI, `${file} prints an emoji`);
  }
  for (const file of HOME_FILES.filter((name) => !name.includes("QuickBites"))) {
    assert.doesNotMatch(
      readRepoFile(file),
      /<Star\b/,
      `${file} draws a lucide Star instead of the rating symbol`,
    );
  }
});

test("every Home card and row presses through PressableScale (0.97, off under Reduce Motion)", () => {
  const cardFiles = [
    "src/components/discover/TrendingList.tsx",
    "src/components/discover/home/DiscoverBiteRail.tsx",
    "src/components/discover/home/PopularFoodStyleItem.tsx",
    "src/components/discover/home/VerticalStallShowcaseSection.tsx",
  ];
  for (const file of cardFiles) {
    assert.match(readRepoFile(file), /<PressableScale\b/, `${file} cards need press feedback`);
  }
  const screen = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const stallRow = screen.slice(screen.indexOf("const renderAreaStallRow"));
  assert.match(stallRow, /<PressableScale\b/, "stall rows need press feedback");

  const pressable = readRepoFile("src/components/ui/PressableScale.tsx");
  assert.match(pressable, /PRESS_SCALE = 0\.97/);
  assert.match(pressable, /PRESS_DURATION_MS = 120/);
  assert.match(pressable, /if \(reduceMotion\) return;/);
});

test("every review taste tag names an AppSymbol row, so the UI never prints its emoji", () => {
  const registry = readRepoFile("src/components/ui/AppSymbol.tsx");
  const rows = new Set(
    [...registry.matchAll(/^ {2}(\w+): \{ ios: "[\w.]+", lucide: \w+/gm)].map((match) => match[1]),
  );
  const tags = Object.entries(REVIEW_TASTE_TAG_META);
  assert.equal(tags.length, 12);
  for (const [tag, meta] of tags) {
    assert.ok(rows.has(meta.symbol), `${tag} names ${meta.symbol}, which AppSymbol does not have`);
    assert.doesNotMatch(JSON.stringify(meta), EMOJI, `${tag} still carries an emoji`);
  }
  assert.equal(new Set(tags.map(([, meta]) => meta.symbol)).size, 12, "one symbol per tag");
});

test("the stall showcase never rotates a stock photo of another dish in (H5-1)", () => {
  const source = readRepoFile("src/features/discover/stallShowcase.ts");
  assert.doesNotMatch(source, /FALLBACK_IMAGES|popularFoodStyles|% /);
  assert.match(source, /imageSource: image\.imageUrl \? \{ uri: image\.imageUrl \} : null/);
});
