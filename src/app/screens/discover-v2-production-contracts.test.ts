import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("discover V2 uses real venue status and keeps consumer map access public", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");

  assert.doesNotMatch(discover, /getNearestBuildings/);
  assert.doesNotMatch(discover, /canAccessMap/);
  assert.doesNotMatch(discover, /index % 2/);
  assert.match(discover, /navigation\.navigate\("DiscoverMap"\)/);
  assert.match(discover, /venue\.verificationStatus === "verified"/);
  assert.match(discover, /venue\.isOpen/);
  assert.match(discover, /nearbyStalls\.length/);
  assert.doesNotMatch(discover, /grade: "A"/);
});

test("discover V2 keeps Zustand selectors referentially stable", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");

  assert.doesNotMatch(
    discover,
    /use[A-Za-z0-9]+Store\(\([^)]*\) => [^;]*(?:\.slice|\.map|\.filter)\(/,
  );
  assert.doesNotMatch(discover, /use[A-Za-z0-9]+Store\(\([^)]*\) => [^;]*\?\? \[\]/);
  assert.match(
    discover,
    /const collections = useMemo\(\s*\(\) => \(FEATURE_FLAGS\.collectionsEnabled \? allCollections\.slice\(0, 6\) : \[\]\)/,
  );
});

test("discover V2 avoids blank rails when no data is available", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");

  assert.match(discover, /recommendedDishes\.length > 0 \?/);
  assert.match(discover, /No trending dishes yet/);
  assert.match(discover, /nearbyStalls\.length > 0 \?/);
  assert.match(discover, /nearbyStalls\.length === 0 \?/);
  assert.match(discover, /No stalls nearby/);
});
