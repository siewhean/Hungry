import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { isLiveMapAvailable } from "./mapAvailability";

const dev = globalThis as { __DEV__?: boolean };
const original = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const originalDev = dev.__DEV__;
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  else process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = original;
  dev.__DEV__ = originalDev;
});

test("a release build with a Mapbox token can draw the map", () => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test";
  dev.__DEV__ = false;
  assert.equal(isLiveMapAvailable(), true);
});

test("a release build with no token cannot, so screens hide their Map switch", () => {
  delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  dev.__DEV__ = false;
  assert.equal(isLiveMapAvailable(), false);
});

test("a dev build with no token still offers the approximate map", () => {
  delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  dev.__DEV__ = true;
  assert.equal(isLiveMapAvailable(), true);
});
