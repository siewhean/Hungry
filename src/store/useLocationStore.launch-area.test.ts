import assert from "node:assert/strict";
import test from "node:test";

import { useLocationStore } from "./useLocationStore";

const STORAGE_NAME = "hungry-location-v1";
const pick = { latitude: 1.3521, longitude: 103.8198 };

async function writePersisted(state: Record<string, unknown>) {
  const storage = useLocationStore.persist.getOptions().storage;
  assert.ok(storage);
  await storage.setItem(STORAGE_NAME, { state: state as never, version: 0 });
}

async function readPersisted(): Promise<Record<string, unknown> | undefined> {
  const storage = useLocationStore.persist.getOptions().storage;
  assert.ok(storage);
  const value = await storage.getItem(STORAGE_NAME);
  return value?.state as Record<string, unknown> | undefined;
}

test.afterEach(async () => {
  await useLocationStore.persist.getOptions().storage?.removeItem(STORAGE_NAME);
});

test("launch area: with location on, a saved area pick is dropped so the app opens at the diner", async () => {
  await writePersisted({
    permission: "granted",
    manualCoordinate: pick,
    manualPlaceName: "Tampines",
    gpsBadgeState: "manual",
  });
  await useLocationStore.persist.rehydrate();

  const state = useLocationStore.getState();
  assert.equal(state.manualCoordinate, undefined);
  assert.equal(state.manualPlaceName, undefined);
  assert.equal(state.gpsBadgeState, "live");
});

test("launch area: with location off, the picked area is kept because it is the only place there is", async () => {
  await writePersisted({
    permission: "denied",
    manualCoordinate: pick,
    manualPlaceName: "Tampines",
    gpsBadgeState: "manual",
  });
  await useLocationStore.persist.rehydrate();

  const state = useLocationStore.getState();
  assert.deepEqual(state.manualCoordinate, pick);
  assert.equal(state.manualPlaceName, "Tampines");
});

test("launch area: an area picked while location is on is not written to storage", async () => {
  useLocationStore.setState({
    permission: "granted",
    manualCoordinate: pick,
    manualPlaceName: "Tampines",
    gpsBadgeState: "manual",
  });
  const saved = await readPersisted();
  assert.equal(saved?.manualCoordinate, undefined);
  assert.equal(saved?.manualPlaceName, undefined);
  assert.equal(saved?.gpsBadgeState, "live");
});
