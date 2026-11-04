import assert from "node:assert/strict";
import test from "node:test";

import { shouldOfferMealPicks } from "./mealPicksNudge";

const ready = {
  isNative: true,
  signedIn: true,
  permission: "undetermined" as const,
  savedOrTriedCount: 1,
  snoozed: false,
};

test("the meal-picks card waits for a first save or tried, on a phone not yet asked", () => {
  assert.equal(shouldOfferMealPicks(ready), true);
  assert.equal(shouldOfferMealPicks({ ...ready, savedOrTriedCount: 0 }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, permission: "granted" }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, permission: "denied" }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, permission: null }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, isNative: false }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, signedIn: false }), false);
  assert.equal(shouldOfferMealPicks({ ...ready, snoozed: true }), false);
});
