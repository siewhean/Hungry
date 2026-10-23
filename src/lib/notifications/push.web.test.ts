import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialNotificationUrl,
  getNotificationPermissionState,
  registerForStallAlerts,
  STALL_UPDATES_CHANNEL_ID,
  subscribeToNotificationOpens,
} from "./push.web";

test("the web build never registers for push and never reports a launch notification", async () => {
  assert.equal(await registerForStallAlerts(), false);
  assert.equal(await registerForStallAlerts({ askPermission: true }), false);
  assert.equal(getInitialNotificationUrl(), null);
});

test("subscribing to notification opens on web is a safe no-op with an unsubscribe", () => {
  let called = false;
  const unsubscribe = subscribeToNotificationOpens(() => {
    called = true;
  });
  assert.equal(typeof unsubscribe, "function");
  unsubscribe();
  assert.equal(called, false);
});

test("the web build exposes the same channel id as the native one", () => {
  assert.equal(STALL_UPDATES_CHANNEL_ID, "stall-updates");
});

test("the web build reports an undetermined permission so Settings can render", async () => {
  assert.equal(await getNotificationPermissionState(), "undetermined");
});
