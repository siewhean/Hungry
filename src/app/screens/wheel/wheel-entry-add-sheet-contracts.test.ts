import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/screens/wheel/WheelEntryAddSheet.tsx"),
  "utf8",
);

test("Wheel add sheet distinguishes catalog loading, failure, and ready states", () => {
  assert.match(source, /type CatalogLoadState = "idle" \| "loading" \| "ready" \| "error"/);
  assert.match(source, /setCatalogLoadState\("loading"\)/);
  assert.match(source, /setCatalogLoadState\("ready"\)/);
  assert.match(source, /setCatalogLoadState\("error"\)/);
  assert.match(source, /accessibilityRole="progressbar"/);
  assert.match(source, /loadingMessage="Loading nearby stalls\.\.\."/);
});

test("Wheel catalog failures and empty nearby results provide explicit recovery actions", () => {
  assert.match(source, /title="Unable to load nearby stalls"/);
  assert.match(source, /body="Check your connection, then try again\."/);
  assert.match(source, /ctaLabel="Try again"/);
  assert.match(source, /title="No nearby stalls available"/);
  assert.match(source, /ctaLabel="Refresh stalls"/);
  assert.match(source, /onPress=\{retryCatalogLoad\}/);
});

test("Surprise cannot silently run before a usable catalog option exists", () => {
  assert.match(source, /if \(catalogLoadState !== "ready"\) return/);
  assert.match(source, /accessibilityState=\{\{ disabled: !hasRandomOption \}\}/);
  assert.match(source, /disabled=\{!hasRandomOption\}/);
  assert.match(source, /All nearby stalls are already on this wheel\./);
  assert.match(
    source,
    /catalogLoadState === "ready" && catalogVenues\.length > 0 && tab === "random"/,
  );
});

test("Wheel tabs announce which option source is selected", () => {
  assert.match(source, /accessibilityLabel=\{`Switch to \$\{t\.label\} tab`\}/);
  assert.match(source, /accessibilityState=\{\{ selected: tab === t\.id \}\}/);
});

test("Wheel match scoring uses the canonical taste-vector contract", () => {
  assert.match(source, /userTaste: TasteVector/);
  assert.match(source, /TASTE_DIMENSIONS\.reduce/);
  assert.doesNotMatch(source, /userTaste: any|tasteVector as any/);
});
