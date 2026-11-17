import test from "node:test";
import assert from "node:assert/strict";

import { dishes, userProfile } from "@/lib/services/mock/data";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { buildWeeklyPicks, getWeeklyPicksKey, isWeeklyPicksPersonalised } from "./weeklyPicks";

test("weekly picks lead with photo dishes when scores are close but keep photo-less ones", () => {
  // Two near-identical dishes at different stalls; only the second has a photo.
  const base = { ...dishes[0], tasteConfidence: 1 };
  const noPhoto = { ...base, id: "no-photo", venueId: "venue-a", imageUrl: "" };
  const withPhoto = { ...base, id: "with-photo", venueId: "venue-b", rating: base.rating - 0.05 };
  const picks = buildWeeklyPicks(
    [noPhoto, withPhoto],
    { ...userProfile, reviewedDishIds: [] },
    "w",
  );

  assert.deepEqual(
    picks.map((pick) => pick.dish.id),
    ["with-photo", "no-photo"],
  );
});

test("weekly picks only claim taste when there is a taste signal", () => {
  const tagged = dishes.filter((dish) => dish.tasteVector.spicy !== 5).slice(0, 3);
  const untagged = tagged.map((dish) => ({ ...dish, tasteVector: { ...NEUTRAL_TASTE_VECTOR } }));
  const spicyUser = { ...NEUTRAL_TASTE_VECTOR, spicy: 9 };

  assert.equal(isWeeklyPicksPersonalised(spicyUser, tagged), true);
  assert.equal(isWeeklyPicksPersonalised({ ...NEUTRAL_TASTE_VECTOR }, tagged), false);
  assert.equal(isWeeklyPicksPersonalised(spicyUser, untagged), false);
  assert.equal(
    isWeeklyPicksPersonalised(
      spicyUser,
      tagged.map((dish) => ({ ...dish, tasteConfidence: 0 })),
    ),
    false,
  );
});

test("weekly key follows Singapore Mondays", () => {
  // Sunday 23:30 SGT is still the previous week; Monday 00:30 SGT starts a new one.
  assert.equal(getWeeklyPicksKey(new Date("2026-10-18T15:30:00Z")), "2026-W42");
  assert.equal(getWeeklyPicksKey(new Date("2026-10-18T16:30:00Z")), "2026-W43");
});

test("weekly picks are one per stall, skip tried dishes and are stable within a week", () => {
  const profile = { ...userProfile, reviewedDishIds: [dishes[0].id] };
  const picks = buildWeeklyPicks(dishes, profile, "2026-W42");

  assert.ok(picks.length > 0 && picks.length <= 5);
  assert.equal(new Set(picks.map((pick) => pick.dish.venueId)).size, picks.length);
  assert.ok(!picks.some((pick) => pick.dish.id === dishes[0].id));
  assert.deepEqual(
    buildWeeklyPicks(dishes, profile, "2026-W42").map((pick) => pick.dish.id),
    picks.map((pick) => pick.dish.id),
  );
});

test("weekly picks return fewer dishes instead of padding when the pool is small", () => {
  const picks = buildWeeklyPicks(dishes.slice(0, 2), { ...userProfile, reviewedDishIds: [] }, "w");
  assert.ok(picks.length <= 2);
});
