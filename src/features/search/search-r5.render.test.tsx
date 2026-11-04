// Round-five Search pieces, rendered on their own: the save heart, the empty state, and the
// "haptic on commit" rule for Button and IconButton.
// Run with `node scripts/test-render.mjs src/features/search/search-r5.render.test.tsx`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import { Button, IconButton } from "@/components/ui";
import {
  SaveHeartButton,
  HEART_SPRING,
  HEART_SPRING_FROM,
} from "@/features/search/SaveHeartButton";
import { SearchEmptyState, describeOtherModeMatches } from "@/features/search/SearchEmptyState";
import { resetHapticThrottle } from "@/lib/haptics";
import { useSearchStore } from "@/store/useSearchStore";
import { useUIStore } from "@/store/useUIStore";
import { colors } from "@/theme/tokens";
import { cleanup, render } from "@/test/render";

const restores: (() => void)[] = [];

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ allowSearchHistory: true });
  useSearchStore.setState({ recentSearches: [] });
  while (restores.length) restores.pop()?.();
});

/** Counts the expo-haptics calls made while a test runs. */
function countHaptics() {
  const calls: string[] = [];
  const haptics = require("expo-haptics") as Record<string, unknown>;
  for (const name of ["impactAsync", "selectionAsync", "notificationAsync"]) {
    const original = haptics[name];
    haptics[name] = async () => {
      calls.push(name);
    };
    restores.push(() => {
      haptics[name] = original;
    });
  }
  resetHapticThrottle();
  return calls;
}

// ---- SaveHeartButton (SR5-4)

test("SaveHeartButton: names the action, ticks once per press and reports the press", async () => {
  const ticks = countHaptics();
  let presses = 0;
  const view = await render(
    createElement(SaveHeartButton, {
      accessibilityLabel: "Save Laksa",
      onPress: () => (presses += 1),
      saved: false,
    }),
  );
  await view.press(view.findByLabel("Save Laksa"));
  assert.equal(presses, 1);
  assert.deepEqual(ticks, ["selectionAsync"]);
});

test("SaveHeartButton: saved is its own colour, never the error red", async () => {
  assert.notEqual(colors.light.saved, colors.light.error);
  assert.notEqual(colors.dark.saved, colors.dark.error);
  const view = await render(
    createElement(SaveHeartButton, {
      accessibilityLabel: "Remove Laksa from saved",
      onPress: () => undefined,
      saved: true,
    }),
  );
  assert.ok(view.findByLabel("Remove Laksa from saved"));
  const source = readFileSync("src/features/search/SaveHeartButton.tsx", "utf8");
  assert.match(source, /palette\.saved/);
  assert.doesNotMatch(source, /palette\.error/);
});

test("SaveHeartButton: one spring on the fill, none on first render, none with Reduce Motion", () => {
  const source = readFileSync("src/features/search/SaveHeartButton.tsx", "utf8");
  assert.equal(HEART_SPRING_FROM, 0.85);
  assert.deepEqual(HEART_SPRING, { damping: 15, stiffness: 300 });
  assert.match(source, /const justSaved = saved && !wasSaved\.current/);
  assert.match(source, /if \(!justSaved \|\| reduceMotion\) return;/);
  assert.match(source, /withSpring\(1, HEART_SPRING\)/);
});

// ---- SearchEmptyState (SR5-6)

test("describeOtherModeMatches counts the other tab", () => {
  assert.equal(describeOtherModeMatches("stalls", 2, "zzz"), "2 stalls match “zzz”");
  assert.equal(describeOtherModeMatches("stalls", 1, "zzz"), "1 stall matches “zzz”");
  assert.equal(describeOtherModeMatches("dishes", 5, "ka"), "5 dishes match “ka”");
});

test("SearchEmptyState: says what happened, then offers the way forward", async () => {
  useSearchStore.setState({ recentSearches: ["bak kut teh", "zzz"] });
  const searched: string[] = [];
  const calls: string[] = [];
  const view = await render(
    createElement(SearchEmptyState, {
      body: "Try another search.",
      query: "zzz",
      suggestedQuery: "Laksa",
      otherMode: { mode: "stalls", count: 2 },
      onSwitchMode: () => calls.push("switch"),
      onClearFilters: () => calls.push("clear"),
      onWiden: () => calls.push("widen"),
      onSearch: (text: string) => searched.push(text),
      popular: ["Laksa", "Chicken Rice", "Nasi Lemak", "Mee Pok", "Roti Prata", "Satay", "Wanton"],
    }),
  );
  assert.match(view.text(), /No matches found/);
  await view.press(view.findByText('Did you mean "Laksa"?'));
  await view.press(view.findByText("2 stalls match “zzz”"));
  await view.press(view.findByText("Clear filters"));
  await view.press(view.findByText("Search all Singapore"));
  await view.press(view.findByLabel("Search Chicken Rice"));
  await view.press(view.findByLabel("Search bak kut teh again"));
  assert.deepEqual(calls, ["switch", "clear", "widen"]);
  assert.deepEqual(searched, ["Laksa", "Chicken Rice", "bak kut teh"]);
  assert.equal(view.findByLabel("Search Wanton"), null, "at most six popular searches");
  assert.equal(view.findByLabel("Search zzz again"), null, "not the search that came up empty");
});

test("SearchEmptyState: recents are left out when search history is off", async () => {
  useSearchStore.setState({ recentSearches: ["bak kut teh"] });
  useUIStore.setState({ allowSearchHistory: false });
  const view = await render(
    createElement(SearchEmptyState, {
      body: "Try another search.",
      query: "zzz",
      onSearch: () => undefined,
      popular: [],
    }),
  );
  assert.equal(view.findByLabel("Recent searches"), null);
});

test("SearchEmptyState: with nothing to offer it is just the message", async () => {
  useSearchStore.setState({ recentSearches: [] });
  const view = await render(
    createElement(SearchEmptyState, {
      body: "Try another search.",
      query: "zzz",
      onSearch: () => undefined,
      popular: [],
    }),
  );
  assert.match(view.text(), /No matches found/);
  assert.equal(view.findByLabel("Popular searches"), null);
  assert.equal(view.findByLabel("Recent searches"), null);
  assert.equal(view.findByText(/Did you mean/), null);
});

// ---- Haptics on commit (SR5-3)

test("Button gives one light tap when the press commits, not on touch-down", async () => {
  const ticks = countHaptics();
  let presses = 0;
  const view = await render(createElement(Button, { label: "Go", onPress: () => (presses += 1) }));
  await view.press(view.findByLabel("Go"));
  assert.equal(presses, 1);
  assert.deepEqual(ticks, ["impactAsync"]);
  const source = readFileSync("src/components/ui/Button.tsx", "utf8");
  const pressIn = source.slice(source.indexOf("onPressIn={"), source.indexOf("onPress={(event)"));
  assert.doesNotMatch(pressIn, /Haptic|impactAsync/);
});

test("IconButton gives one light tap when the press commits, not on touch-down", async () => {
  const ticks = countHaptics();
  let presses = 0;
  const view = await render(
    createElement(IconButton, {
      accessibilityLabel: "Go back",
      icon: createElement("span", null, "<"),
      onPress: () => (presses += 1),
    }),
  );
  await view.press(view.findByLabel("Go back"));
  assert.equal(presses, 1);
  assert.deepEqual(ticks, ["impactAsync"]);
  const source = readFileSync("src/components/ui/IconButton.tsx", "utf8");
  const pressIn = source.slice(source.indexOf("onPressIn={"), source.indexOf("onPress={"));
  assert.doesNotMatch(pressIn, /Haptic|impactAsync/);
});

test("a disabled Button gives no tap", async () => {
  const ticks = countHaptics();
  const view = await render(
    createElement(Button, { label: "Go", disabled: true, onPress: () => undefined }),
  );
  await view.press(view.findByLabel("Go"));
  assert.deepEqual(ticks, []);
});
