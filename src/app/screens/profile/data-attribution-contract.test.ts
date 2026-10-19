import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Settings About credits the open data sources behind venue details", () => {
  const source = readFileSync("src/app/screens/profile/SettingsScreen.tsx", "utf8");
  assert.match(source, /label="Data sources"/);
  assert.match(source, /© OpenStreetMap contributors/);
  assert.match(source, /Overture Maps Foundation/);
  assert.match(source, /Foursquare Open Source Places/);
});
