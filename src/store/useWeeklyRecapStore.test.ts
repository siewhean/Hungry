import assert from "node:assert/strict";
import test from "node:test";

import { useWeeklyRecapStore } from "./useWeeklyRecapStore";

test("closing a recap remembers its week", () => {
  assert.equal(useWeeklyRecapStore.getState().dismissedWeek, null);
  useWeeklyRecapStore.getState().dismiss(2920);
  assert.equal(useWeeklyRecapStore.getState().dismissedWeek, 2920);
});
