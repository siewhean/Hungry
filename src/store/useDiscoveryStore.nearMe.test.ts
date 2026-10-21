import assert from "node:assert/strict";
import test from "node:test";

import { useDiscoveryStore } from "./useDiscoveryStore";

test("Near me starts off", () => {
  assert.equal(useDiscoveryStore.getState().mapFilters.nearMe, false);
});

test("Near me is never saved on, and an old saved 'on' is dropped", () => {
  const options = useDiscoveryStore.persist.getOptions();
  useDiscoveryStore.getState().toggleMapFilter("nearMe");
  useDiscoveryStore.getState().toggleMapFilter("openNow");
  try {
    const saved = options.partialize?.(useDiscoveryStore.getState()) as {
      mapFilters: { nearMe: boolean; openNow: boolean };
    };
    assert.equal(saved.mapFilters.nearMe, false);
    // Other filters are still remembered.
    assert.equal(saved.mapFilters.openNow, true);

    const merged = options.merge?.(
      { mapFilters: { ...saved.mapFilters, nearMe: true } },
      useDiscoveryStore.getState(),
    );
    assert.equal(merged?.mapFilters.nearMe, false);
    assert.equal(merged?.mapFilters.openNow, true);
  } finally {
    useDiscoveryStore.getState().toggleMapFilter("nearMe");
    useDiscoveryStore.getState().toggleMapFilter("openNow");
  }
});
