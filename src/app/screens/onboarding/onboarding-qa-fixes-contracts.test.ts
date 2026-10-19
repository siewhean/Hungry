import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SORTED_SINGAPORE_AREAS, sortAreasByName } from "./singaporeAreas";

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), "src/app/screens/onboarding", relativePath), "utf8");

test("location steps continue to the optional taste quiz without completing onboarding", () => {
  const manual = read("ManualLocationPickerScreen.tsx");
  const permission = read("LocationPermissionScreen.tsx");

  assert.match(
    manual,
    /setManualSelection\(selectedArea\.name, selectedArea\.coordinate\);[\s\S]*?navigation\.navigate\("TasteQuiz"\);/,
  );
  for (const source of [manual, permission]) {
    assert.doesNotMatch(source, /completeOnboarding\(/);
  }
  assert.match(permission, /navigation\.navigate\("TasteQuiz"\)/);
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
  assert.match(source, /paddingTop: insets\.top \+ spacing\[4\]/);
  assert.match(source, /paddingBottom: insets\.bottom \+ spacing\[3\]/);
  assert.match(source, /const hasDishes = dishes\.length > 0;/);
  assert.match(source, /\{hasDishes \? \(\s*<View/);
  assert.match(source, /backgroundColor: palette\.surfaceRaised/);
});

test("onboarding copy stays within Release 0.1 MVP scope", () => {
  const copy = ["WelcomeScreen.tsx", "LocationPermissionScreen.tsx"].map(read).join("\n");
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
