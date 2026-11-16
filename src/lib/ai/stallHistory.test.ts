import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStallSignal,
  buildStallHistory,
  stallAffinityScore,
  STALL_AFFINITY_WEIGHTS,
  type UserStallAffinity,
} from "@/lib/ai/stallHistory";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-11-01T00:00:00Z");

test("one view is not a habit; directions and a save make a liked stall", () => {
  const viewed = applyStallSignal(undefined, "s1", "view", T0);
  assert.ok(stallAffinityScore(viewed, T0) < 0.4);
  const liked = applyStallSignal(
    applyStallSignal(viewed, "s1", "directions", T0),
    "s1",
    "saved",
    T0,
  );
  assert.equal(liked.evidence, STALL_AFFINITY_WEIGHTS.view + 3 + 3);
  assert.ok(stallAffinityScore(liked, T0) >= 0.4);
});

test("evidence halves every 90 days, as on the server", () => {
  const row = applyStallSignal(undefined, "s1", "directions", T0);
  const later = applyStallSignal(row, "s1", "view", T0 + 90 * DAY);
  assert.ok(Math.abs(later.evidence - (3 / 2 + 1)) < 1e-9);
});

test("Not for me hides a stall for 30 days and keeps it out of liked and recent", () => {
  const rows: UserStallAffinity[] = [
    applyStallSignal(undefined, "hidden", "not_for_me", T0),
    applyStallSignal(
      applyStallSignal(undefined, "liked", "saved", T0),
      "liked",
      "tried",
      T0 + 1000,
    ),
    applyStallSignal(undefined, "seen", "view", T0 + 2000),
  ];
  const history = buildStallHistory(rows, T0 + DAY);
  assert.ok(history.hiddenVenueIds.has("hidden"));
  assert.deepEqual(history.likedVenueIds, ["liked"]);
  assert.deepEqual(history.recentVenueIds, ["seen", "liked"]);
  assert.equal(buildStallHistory(rows, T0 + 31 * DAY).hiddenVenueIds.size, 0);
});
