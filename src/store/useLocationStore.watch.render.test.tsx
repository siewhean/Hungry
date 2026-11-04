import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { useLocationStore } from "./useLocationStore";

type Callback = (position: { coords: { latitude: number; longitude: number } }) => void;

/** Replaces the parts of expo-location the watch uses; returns what happened and a restore. */
function stubLocation() {
  const Location = require("expo-location") as Record<string, unknown>;
  const original = { ...Location };
  const calls = { watchStarts: 0, removed: 0 };
  let report: Callback | undefined;
  Location.Accuracy = { Balanced: 3 };
  Location.getForegroundPermissionsAsync = async () => ({ status: "granted" });
  Location.watchPositionAsync = async (_options: unknown, callback: Callback) => {
    calls.watchStarts += 1;
    report = callback;
    return { remove: () => (calls.removed += 1) };
  };
  return {
    calls,
    move: (latitude: number, longitude: number) => report?.({ coords: { latitude, longitude } }),
    restore: () => Object.assign(Location, original),
  };
}

afterEach(() => {
  useLocationStore.getState().stopLocationWatch();
  useLocationStore.setState({ permission: "unknown", manualCoordinate: undefined });
});

test("the watch moves the current location as the phone moves", async () => {
  const stub = stubLocation();
  try {
    useLocationStore.setState({ permission: "granted", manualCoordinate: undefined });
    await useLocationStore.getState().startLocationWatch();
    assert.equal(stub.calls.watchStarts, 1);
    stub.move(1.333, 103.74);
    assert.deepEqual(useLocationStore.getState().currentLocation, {
      latitude: 1.333,
      longitude: 103.74,
    });
    // A second start while watching does not open another watch.
    await useLocationStore.getState().startLocationWatch();
    assert.equal(stub.calls.watchStarts, 1);
    useLocationStore.getState().stopLocationWatch();
    assert.equal(stub.calls.removed, 1);
  } finally {
    stub.restore();
  }
});

test("a hand-picked area is not overwritten by the watch, and nothing starts without permission", async () => {
  const stub = stubLocation();
  try {
    useLocationStore.setState({ permission: "denied", manualCoordinate: undefined });
    await useLocationStore.getState().startLocationWatch();
    assert.equal(stub.calls.watchStarts, 0);

    const manual = { latitude: 1.35, longitude: 103.94 };
    useLocationStore.setState({ permission: "granted", manualCoordinate: manual });
    await useLocationStore.getState().startLocationWatch();
    assert.equal(stub.calls.watchStarts, 0);
  } finally {
    stub.restore();
  }
});
