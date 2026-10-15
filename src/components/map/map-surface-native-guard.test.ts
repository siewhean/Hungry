import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const source = readRepoFile("src/components/map/MapSurface.tsx");

test("MapSurface requires @rnmapbox/maps lazily inside a try/catch", () => {
  const requireMatches = source.match(/require\("@rnmapbox\/maps"\)/g) ?? [];
  assert.equal(requireMatches.length, 1, "exactly one runtime require of @rnmapbox/maps");
  assert.doesNotMatch(source, /^import[^;]*from "@rnmapbox\/maps"/m);

  const getter = source.slice(source.indexOf("function getMapboxGL"));
  const tryIndex = getter.indexOf("try {");
  const requireIndex = getter.indexOf('require("@rnmapbox/maps")');
  const catchIndex = getter.indexOf("} catch");
  assert.ok(tryIndex >= 0 && tryIndex < requireIndex && requireIndex < catchIndex);
  assert.match(getter, /cachedMapboxGL = null;/);
  assert.match(source, /function getMapboxGL\(\): MapboxModule \| null/);
});

test("MapSurface renders the fallback map when the native module is unavailable", () => {
  assert.match(source, /const shouldUseFallback = !MapboxGL;/);
  assert.match(source, /if \(shouldUseFallback\) \{[\s\S]*?<FallbackMap/);
  assert.match(source, /if \(!MapboxGL \|\| !MAPBOX_ACCESS_TOKEN \|\| hasConfiguredMapboxToken\)/);
  // The native branch must not re-require the module unguarded.
  assert.equal((source.match(/getMapboxGL\(\);/g) ?? []).length, 1);
});
