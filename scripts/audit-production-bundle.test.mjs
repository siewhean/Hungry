import assert from "node:assert/strict";
import test from "node:test";

import { REQUIRED_PRODUCTION_SOURCES, auditSources } from "./audit-production-bundle.mjs";

const validSources = [
  ...REQUIRED_PRODUCTION_SOURCES,
  "/src/app/screens/discover/DiscoverHomeScreen.tsx",
];

test("accepts a production-only source graph", () => {
  assert.deepEqual(auditSources(validSources), {
    forbidden: [],
    missing: [],
    sourceCount: validSources.length,
  });
});

test("reports mock and disabled feature sources", () => {
  const result = auditSources([
    ...validSources,
    "/src/lib/services/mock/data.ts",
    "/src/app/screens/wheel/WheelStack.tsx",
  ]);

  assert.deepEqual(
    result.forbidden.map(({ label }) => label),
    ["mock service or fixtures", "Wheel screens"],
  );
});

test("reports a missing production boundary", () => {
  const result = auditSources(validSources.slice(1));
  assert.deepEqual(result.missing, [REQUIRED_PRODUCTION_SOURCES[0]]);
});
