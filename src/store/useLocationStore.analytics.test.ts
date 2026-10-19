import assert from "node:assert/strict";
import test from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useLocationStore } from "./useLocationStore";

test("grantLocation tracks denied analytics when location module is unavailable", async () => {
  clearTrackedAnalyticsEvents();
  useLocationStore.getState().resetLocationState();

  const granted = await useLocationStore.getState().grantLocation();
  assert.equal(granted, false);

  const events = getTrackedAnalyticsEvents().filter(
    (event) => event.event === "location_permission_result",
  );
  assert.ok(events.length > 0);
  assert.equal(events[events.length - 1]?.properties.reason, "module_unavailable");
});

test("manual location selection sends only coarse coordinates to analytics", () => {
  clearTrackedAnalyticsEvents();
  useLocationStore.getState().resetLocationState();

  useLocationStore
    .getState()
    .setManualSelection("Tampines Hub", { latitude: 1.352083, longitude: 103.940612 });

  const event = getTrackedAnalyticsEvents().find(
    (entry) => entry.properties.result === "manual_selection",
  );
  assert.equal(event?.properties.latitude, 1.35);
  assert.equal(event?.properties.longitude, 103.94);
  assert.deepEqual(useLocationStore.getState().currentLocation, {
    latitude: 1.352083,
    longitude: 103.940612,
  });
});

test("manual selection keeps the OS permission and clearing it returns to device location", async () => {
  useLocationStore.getState().resetLocationState();
  useLocationStore.setState({ permission: "granted", lastLocationFixAt: 0 });

  useLocationStore
    .getState()
    .setManualSelection("Tampines Hub", { latitude: 1.352083, longitude: 103.940612 });
  assert.equal(useLocationStore.getState().permission, "granted");
  assert.equal(useLocationStore.getState().gpsBadgeState, "manual");
  // GPS refresh must not overwrite a manual pick.
  assert.equal(await useLocationStore.getState().refreshLocation({ force: true }), false);
  assert.deepEqual(useLocationStore.getState().currentLocation, {
    latitude: 1.352083,
    longitude: 103.940612,
  });

  await useLocationStore.getState().clearManualLocation();
  assert.equal(useLocationStore.getState().manualLocation, undefined);
  assert.equal(useLocationStore.getState().manualCoordinate, undefined);
  assert.equal(useLocationStore.getState().permission, "granted");
  assert.equal(useLocationStore.getState().gpsBadgeState, "live");

  // Without permission, clearing falls back to the default area instead of the old pick.
  useLocationStore.setState({ permission: "denied" });
  useLocationStore
    .getState()
    .setManualSelection("Tampines Hub", { latitude: 1.352083, longitude: 103.940612 });
  await useLocationStore.getState().clearManualLocation();
  assert.notDeepEqual(useLocationStore.getState().currentLocation, {
    latitude: 1.352083,
    longitude: 103.940612,
  });
  assert.equal(useLocationStore.getState().permission, "denied");
  useLocationStore.getState().resetLocationState();
});

test("refreshLocation never prompts and skips when permission is not granted", async () => {
  useLocationStore.getState().resetLocationState();
  assert.equal(await useLocationStore.getState().refreshLocation(), false);
  assert.equal(useLocationStore.getState().permission, "unknown");

  // A fresh fix is not re-read.
  useLocationStore.setState({ permission: "granted", lastLocationFixAt: Date.now() });
  assert.equal(await useLocationStore.getState().refreshLocation(), false);
  useLocationStore.getState().resetLocationState();
});
