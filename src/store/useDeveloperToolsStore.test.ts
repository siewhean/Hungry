import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  DEVELOPER_UNLOCK_TAPS,
  DEVELOPER_UNLOCK_WINDOW_MS,
  useDeveloperToolsStore,
} from "./useDeveloperToolsStore";

beforeEach(() => {
  useDeveloperToolsStore.getState().lock();
});

test("seven quick taps unlock the tools and the seventh says so", () => {
  const { registerVersionTap } = useDeveloperToolsStore.getState();
  const results = Array.from({ length: DEVELOPER_UNLOCK_TAPS }, (_, index) =>
    registerVersionTap(1000 + index * 100),
  );
  assert.deepEqual(results, [false, false, false, false, false, false, true]);
  assert.equal(useDeveloperToolsStore.getState().unlocked, true);
});

test("a pause between taps starts the count again", () => {
  const { registerVersionTap } = useDeveloperToolsStore.getState();
  for (let tap = 0; tap < 6; tap += 1) registerVersionTap(1000 + tap * 100);
  assert.equal(registerVersionTap(1500 + DEVELOPER_UNLOCK_WINDOW_MS + 1), false);
  assert.equal(useDeveloperToolsStore.getState().unlocked, false);
  assert.equal(useDeveloperToolsStore.getState().tapCount, 1);
});

test("taps after unlocking do nothing, and locking closes the tools again", () => {
  const store = useDeveloperToolsStore.getState();
  for (let tap = 0; tap < DEVELOPER_UNLOCK_TAPS; tap += 1) store.registerVersionTap(1000 + tap);
  assert.equal(useDeveloperToolsStore.getState().registerVersionTap(2000), false);
  useDeveloperToolsStore.getState().lock();
  assert.equal(useDeveloperToolsStore.getState().unlocked, false);
});
