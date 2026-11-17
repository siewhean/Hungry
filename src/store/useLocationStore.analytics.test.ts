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

test("refreshLocation never prompts and skips when permission is not granted", async () => {
  useLocationStore.getState().resetLocationState();
  assert.equal(await useLocationStore.getState().refreshLocation(), false);
  assert.equal(useLocationStore.getState().permission, "unknown");

  // A fresh fix is not re-read.
  useLocationStore.setState({ permission: "granted", lastLocationFixAt: Date.now() });
  assert.equal(await useLocationStore.getState().refreshLocation(), false);
  useLocationStore.getState().resetLocationState();
});

test("a delayed GPS fix is discarded after manual selection and account reset", async () => {
  const { resolveCurrentLocationRequest } = await import("./useLocationStore");
  useLocationStore.getState().resetLocationState();
  const chosen = useLocationStore.getState().currentLocation;
  let finish!: (value: typeof chosen) => void;
  const delayedFix = resolveCurrentLocationRequest(
    () =>
      new Promise<typeof chosen>((resolve) => {
        finish = resolve;
      }),
  );
  useLocationStore.getState().setManualSelection("Selected area", chosen);
  finish({ ...chosen, latitude: chosen.latitude + 0.01 });
  assert.equal(await delayedFix, undefined);
  assert.equal(useLocationStore.getState().manualLocation, "Selected area");
  assert.deepEqual(useLocationStore.getState().currentLocation, chosen);

  const pendingAfterLogout = resolveCurrentLocationRequest(
    () =>
      new Promise<typeof chosen>((resolve) => {
        finish = resolve;
      }),
  );
  useLocationStore.getState().resetLocationState();
  finish(chosen);
  assert.equal(await pendingAfterLogout, undefined);
  assert.equal(useLocationStore.getState().gpsBadgeState, "unknown");
});
