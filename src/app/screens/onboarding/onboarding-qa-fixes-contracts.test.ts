import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SORTED_SINGAPORE_AREAS, sortAreasByName } from "./singaporeAreas";

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), "src/app/screens/onboarding", relativePath), "utf8");

test("manual location picker continues like LocationPermission (shared finish step)", () => {
  const manual = read("ManualLocationPickerScreen.tsx");
  const permission = read("LocationPermissionScreen.tsx");
  const finish = read("finishLocationStep.ts");

  assert.match(manual, /const finishLocationStep = useFinishLocationStep\(navigation\)/);
  assert.match(
    manual,
    /setManualSelection\(selectedArea\.name, selectedArea\.coordinate\);\s*finishLocationStep\(\);/,
  );
  assert.doesNotMatch(manual, /completeOnboarding\(/);
  assert.match(permission, /const finish = useFinishLocationStep\(navigation\)/);
  assert.match(finish, /completeOnboarding\(hasSkippedTasteQuiz\)/);
  assert.match(finish, /navigation\.navigate\("OnboardingAuth"\)/);
  assert.match(finish, /routes: \[\{ name: "MainTabs", params: \{ screen: "Home" \} \}\]/);
});

test("manual location list is alphabetical", () => {
  const names = SORTED_SINGAPORE_AREAS.map((area) => area.name);
  const expected = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  assert.deepEqual(names, expected);
  assert.ok(names.indexOf("Changi") < names.indexOf("Choa Chu Kang"));
  assert.ok(names.indexOf("Sengkang") < names.indexOf("Serangoon"));
  assert.deepEqual(
    sortAreasByName([{ name: "b" }, { name: "A" }, { name: "c" }]).map((a) => a.name),
    ["A", "b", "c"],
  );
  assert.match(read("ManualLocationPickerScreen.tsx"), /SORTED_SINGAPORE_AREAS/);
});

test("taste profile result respects safe area and hides the grid when no dishes", () => {
  const source = read("TasteProfileResultScreen.tsx");
  assert.match(source, /<SafeAreaView[\s\S]*edges=\{\["top", "left", "right", "bottom"\]\}/);
  assert.match(source, /const hasDishes = dishes\.length > 0;/);
  assert.match(source, /\{hasDishes \? \(\s*<View/);
  assert.match(source, /backgroundColor: palette\.surfaceRaised/);
});

test("onboarding copy stays within Release 0.1 MVP scope", () => {
  const copy = [
    "OnboardingIntro1Screen.tsx",
    "OnboardingIntro2Screen.tsx",
    "OnboardingIntro3Screen.tsx",
    "LocationPermissionScreen.tsx",
    "CuisineSelectionScreen.tsx",
  ]
    .map(read)
    .join("\n");
  for (const outOfScope of [
    /Home feed/,
    /Bites/,
    /dish clips/i,
    /stories and guides/i,
    /precise directions/i,
    /shape your feed/i,
  ]) {
    assert.doesNotMatch(copy, outOfScope);
  }
});

test("food selection requires a pick on every cuisine step and tiles show a placeholder", () => {
  const food = read("FoodSelectionScreen.tsx");
  const cuisine = read("CuisineSelectionScreen.tsx");
  assert.match(food, /const isNextDisabled = currentStepSelectionCount === 0;/);
  assert.doesNotMatch(food, /currentIndex === 0 &&/);
  assert.match(cuisine, /disabled=\{selected\.length === 0\}/);
  for (const source of [food, cuisine]) {
    assert.match(source, /backgroundColor: palette\.surfaceRaised/);
  }
});
