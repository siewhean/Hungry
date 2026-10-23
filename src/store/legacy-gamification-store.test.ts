import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  LEVEL_CONFIG,
  POINTS_PER_ACTION,
  resolveLevelProgress,
  resolveTier,
  useGamificationStore,
} from "./useGamificationStore";

beforeEach(() => {
  useGamificationStore.setState({ totalPoints: 150, lastEarnedPoints: 0, isLoaded: false });
});

test("resolveTier picks the highest tier whose threshold is met", () => {
  assert.equal(resolveTier(0).name, "Hungry Newbie");
  assert.equal(resolveTier(49).name, "Hungry Newbie");
  assert.equal(resolveTier(50).name, "Level 2 Eater");
  assert.equal(resolveTier(149).name, "Level 2 Eater");
  assert.equal(resolveTier(150).name, "Level 3 Foodie");
  assert.equal(resolveTier(99_999).name, "Hungry Legend");
});

test("tier thresholds are strictly increasing so resolveTier can stop at the first miss", () => {
  for (let index = 1; index < LEVEL_CONFIG.length; index += 1) {
    assert.ok(LEVEL_CONFIG[index].minPoints > LEVEL_CONFIG[index - 1].minPoints);
  }
});

test("resolveLevelProgress runs 0 to 1 between tiers and is 1 at the top tier", () => {
  assert.equal(resolveLevelProgress(0), 0);
  assert.equal(resolveLevelProgress(25), 0.5);
  assert.equal(resolveLevelProgress(50), 0);
  assert.equal(resolveLevelProgress(1200), 1);
  assert.equal(resolveLevelProgress(5000), 1);
});

test("awardPoints adds the action's points, records the last award and returns the new total", () => {
  const { awardPoints } = useGamificationStore.getState();
  assert.equal(awardPoints("photoAttached"), 150 + POINTS_PER_ACTION.photoAttached);
  assert.equal(useGamificationStore.getState().lastEarnedPoints, POINTS_PER_ACTION.photoAttached);
  assert.equal(
    awardPoints("shareStall"),
    150 + POINTS_PER_ACTION.photoAttached + POINTS_PER_ACTION.shareStall,
  );
  assert.equal(useGamificationStore.getState().lastEarnedPoints, POINTS_PER_ACTION.shareStall);
});

test("tier() and levelProgress() follow the stored total", () => {
  const store = useGamificationStore.getState();
  assert.equal(store.tier().name, "Level 3 Foodie");
  useGamificationStore.setState({ totalPoints: 350 });
  assert.equal(useGamificationStore.getState().tier().name, "Level 4 Hawker");
  assert.equal(useGamificationStore.getState().levelProgress(), 0);
});

test("loadProfile marks the store loaded and _reset clears everything", async () => {
  await useGamificationStore.getState().loadProfile();
  assert.equal(useGamificationStore.getState().isLoaded, true);
  useGamificationStore.getState()._reset();
  const state = useGamificationStore.getState();
  assert.deepEqual([state.totalPoints, state.lastEarnedPoints, state.isLoaded], [0, 0, false]);
});
