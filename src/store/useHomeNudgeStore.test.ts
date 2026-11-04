import assert from "node:assert/strict";
import test from "node:test";

import { HOME_NUDGE_SNOOZE_MS, useHomeNudgeStore } from "./useHomeNudgeStore";

test("Not now snoozes the meal-picks card for two weeks, then it may come back", () => {
  useHomeNudgeStore.setState({ mealPicksSnoozedAt: null });
  assert.equal(useHomeNudgeStore.getState().isMealPicksSnoozed(1_000), false);
  useHomeNudgeStore.getState().snoozeMealPicks(1_000);
  assert.equal(useHomeNudgeStore.getState().isMealPicksSnoozed(1_000 + 60_000), true);
  assert.equal(
    useHomeNudgeStore.getState().isMealPicksSnoozed(1_000 + HOME_NUDGE_SNOOZE_MS + 1),
    false,
  );
});
