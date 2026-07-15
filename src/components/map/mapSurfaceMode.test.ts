import assert from "node:assert/strict";
import test from "node:test";

import { resolveMapSurfaceMode } from "@/components/map/mapSurfaceMode";

test("production ignores mock mode and fails closed without a Mapbox token", () => {
  assert.equal(resolveMapSurfaceMode("production", true, "pk.live"), "live");
  assert.equal(resolveMapSurfaceMode("production", true, ""), "unavailable");
  assert.equal(resolveMapSurfaceMode("production", false, undefined), "unavailable");
});

test("non-production environments retain the explicit inspectable mock surface", () => {
  assert.equal(resolveMapSurfaceMode("development", true, "pk.test"), "mock");
  assert.equal(resolveMapSurfaceMode("development", false, ""), "mock");
  assert.equal(resolveMapSurfaceMode("staging", false, "pk.staging"), "live");
});
