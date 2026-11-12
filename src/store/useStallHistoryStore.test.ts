import assert from "node:assert/strict";
import test from "node:test";

import { useStallHistoryStore } from "./useStallHistoryStore";

const reset = () =>
  useStallHistoryStore.setState({ rows: [], ownerId: "u1", viewHistoryPaused: false });

test("a signal counts on this device at once", () => {
  reset();
  useStallHistoryStore.getState().record("s1", "directions", 1_000);
  useStallHistoryStore.getState().record("s1", "view", 2_000);
  const [row] = useStallHistoryStore.getState().rows;
  assert.equal(row.venueId, "s1");
  assert.ok(Math.abs(row.evidence - 4) < 1e-3, "directions 3 plus a view 1, a second later");
});

test("paused viewing history drops views and opened reviews, never actions", () => {
  reset();
  useStallHistoryStore.getState().setViewHistoryPaused(true);
  useStallHistoryStore.getState().record("s1", "view");
  useStallHistoryStore.getState().record("s1", "review_opened");
  assert.equal(useStallHistoryStore.getState().rows.length, 0);
  useStallHistoryStore.getState().record("s1", "not_for_me");
  assert.equal(useStallHistoryStore.getState().rows.length, 1);
});

test("another account starts empty, and reset clears the history", async () => {
  reset();
  useStallHistoryStore.getState().record("s1", "share");
  await useStallHistoryStore.getState().load("u2");
  assert.equal(useStallHistoryStore.getState().rows.length, 0);
  assert.equal(useStallHistoryStore.getState().ownerId, "u2");
  useStallHistoryStore.getState().record("s2", "share");
  await useStallHistoryStore.getState().reset();
  assert.equal(useStallHistoryStore.getState().rows.length, 0);
});
