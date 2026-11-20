import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

// PostHog on, with the stub client: the store tells it which phones are the team's.
process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const registered: unknown[] = [];
PostHogStub.prototype.register = function (properties) {
  registered.push(properties);
  return Promise.resolve();
};

import {
  DEVELOPER_UNLOCK_TAPS,
  DEVELOPER_UNLOCK_WINDOW_MS,
  useDeveloperToolsStore,
} from "./useDeveloperToolsStore";

beforeEach(() => {
  useDeveloperToolsStore.getState().lock();
  registered.length = 0;
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

test("marking a device as the team's is saved on the device, and Lock does not clear it", () => {
  useDeveloperToolsStore.getState().setInternalDevice(true);
  assert.equal(useDeveloperToolsStore.getState().internalDevice, true);
  useDeveloperToolsStore.getState().lock();
  assert.equal(useDeveloperToolsStore.getState().internalDevice, true);
  useDeveloperToolsStore.getState().setInternalDevice(false);
  assert.equal(useDeveloperToolsStore.getState().internalDevice, false);
});

test("switching a phone on or off tells PostHog, and a saved mark is sent again after a restart", async () => {
  useDeveloperToolsStore.getState().setInternalDevice(true);
  assert.deepEqual(registered.at(-1), { is_internal: true });

  registered.length = 0;
  await useDeveloperToolsStore.persist.rehydrate();
  assert.equal(useDeveloperToolsStore.getState().internalDevice, true);
  assert.deepEqual(registered, [{ is_internal: true }], "applied again on launch");

  useDeveloperToolsStore.getState().setInternalDevice(false);
  assert.equal(registered.at(-1) !== undefined, true);
  registered.length = 0;
  await useDeveloperToolsStore.persist.rehydrate();
  assert.deepEqual(registered, [], "an ordinary phone is left alone");
});
