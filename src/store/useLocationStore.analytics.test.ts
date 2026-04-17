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
