import assert from "node:assert/strict";
import test from "node:test";

import { LOADING_TIPS, tipAt, withTimeout } from "./loadingTips";

test("tips rotate and wrap around, even for a negative count", () => {
  assert.equal(tipAt(0), LOADING_TIPS[0]);
  assert.equal(tipAt(LOADING_TIPS.length), LOADING_TIPS[0]);
  assert.equal(tipAt(-1), LOADING_TIPS[LOADING_TIPS.length - 1]);
});

test("a request that finishes in time resolves with its value", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
});

test("a request that fails keeps its own error", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("offline")), 50), /offline/);
});

test("a request that never finishes is cut off", async () => {
  await assert.rejects(withTimeout(new Promise<never>(() => undefined), 10), /timed out/);
});
