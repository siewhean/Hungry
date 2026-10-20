import assert from "node:assert/strict";
import test from "node:test";

import {
  affinityScore,
  applyAffinityEvent,
  buildFoodHistory,
  deriveLocalFoodHistory,
  mergeFoodHistory,
} from "./foodHistory";
import type { UserDishAffinity } from "@/types/domain";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-01-01T00:00:00Z");

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
}

test("one save, one tap and a like are shrunk toward zero", () => {
  close(
    affinityScore(applyAffinityEvent(undefined, { dishId: "d", signal: "favourite", at: T0 }), T0),
    0.6,
  );
  close(
    affinityScore(applyAffinityEvent(undefined, { dishId: "d", signal: "click", at: T0 }), T0),
    1 / 3,
  );
  close(
    affinityScore(applyAffinityEvent(undefined, { dishId: "d", signal: "dish_like", at: T0 }), T0),
    0.5,
  );
});

test("evidence halves every 90 days and the score stays within [-1, 1]", () => {
  const row = applyAffinityEvent(undefined, { dishId: "d", signal: "favourite", at: T0 });
  // 3 * 0.5 / (2 + 3 * 0.5)
  close(affinityScore(row, T0 + 90 * DAY), 1.5 / 3.5);
  let strong: UserDishAffinity | undefined;
  for (let index = 0; index < 50; index += 1) {
    strong = applyAffinityEvent(strong, { dishId: "d", signal: "review_positive", at: T0 });
  }
  const score = affinityScore(strong!, T0);
  assert.ok(score < 1 && score > 0.95);
});

test("server parity: same replay as supabase/smoke/user_dish_affinities.sql", () => {
  let row = applyAffinityEvent(undefined, { dishId: "d", signal: "favourite", at: T0 });
  row = applyAffinityEvent(row, { dishId: "d", signal: "dish_like", at: T0 + 90 * DAY });
  row = applyAffinityEvent(row, { dishId: "d", signal: "dismissed", at: T0 + 90 * DAY });
  close(row.evidence, -0.5);
  close(row.absEvidence, 7.5);
  assert.equal(row.dismissedUntil, new Date(T0 + 120 * DAY).toISOString());
});

test("buildFoodHistory: liked dishes, liked food types per venue, dismissals", () => {
  const now = T0;
  const rows = [
    applyAffinityEvent(undefined, {
      dishId: "cr-1",
      signal: "favourite",
      at: now,
      foodType: " Chicken Rice ",
      venueId: "v1",
    }),
    applyAffinityEvent(undefined, { dishId: "tap", signal: "click", at: now, foodType: "laksa" }),
    applyAffinityEvent(undefined, { dishId: "nope", signal: "dismissed", at: now }),
  ];
  const history = buildFoodHistory(rows, now);
  assert.deepEqual([...history.likedDishIds], ["cr-1"]);
  assert.deepEqual([...history.likedFoodTypes.keys()], ["chicken rice"]);
  assert.deepEqual([...(history.venuesByFoodType.get("chicken rice") ?? [])], ["v1"]);
  // One tap is not a habit.
  assert.ok(!history.likedFoodTypes.has("laksa"));
  assert.ok(history.dismissedDishIds.has("nope"));
  assert.ok(!buildFoodHistory(rows, now + 31 * DAY).dismissedDishIds.has("nope"));
});

test("guests: favourites and tried dishes count; server rows win on merge", () => {
  const local = deriveLocalFoodHistory(
    { favouriteDishIds: ["a"], reviewedDishIds: ["b"] },
    (dishId) => ({ venueId: `v-${dishId}`, foodTypeTag: "noodles" }),
    T0,
  );
  const history = buildFoodHistory(local, T0);
  assert.deepEqual([...history.likedDishIds].sort(), ["a", "b"]);
  const server = applyAffinityEvent(undefined, { dishId: "a", signal: "dismissed", at: T0 });
  const merged = mergeFoodHistory([server], local);
  assert.equal(merged.find((row) => row.dishId === "a")?.evidence, -4);
  assert.equal(merged.length, 2);
});
