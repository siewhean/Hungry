import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { computeAchievements, type AchievementInput } from "@/features/achievements/achievements";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useMomentStore } from "@/store/useMomentStore";

const EMPTY: AchievementInput = {
  triedDishes: 0,
  distinctCentres: 0,
  stallsVisited: 0,
  spicyDishes: 0,
  sweetDishes: 0,
  budgetDishes: 0,
  reviewsWritten: 0,
  dishesSaved: 0,
};

beforeEach(() => {
  useMomentStore.getState()._reset();
  clearTrackedAnalyticsEvents();
});

test("the first report for a diner remembers their tiers and celebrates nothing", () => {
  const unlocks = useMomentStore
    .getState()
    .reportAchievements("u1", computeAchievements({ ...EMPTY, triedDishes: 12 }));
  assert.deepEqual(unlocks, []);
  assert.deepEqual(useMomentStore.getState().queue, []);
  assert.equal(useMomentStore.getState().levelsByUser.u1?.["dish-collector"], 1);
  assert.equal(
    getTrackedAnalyticsEvents().some((event) => event.event === "achievement_unlocked"),
    false,
  );
});

test("a later tier is queued once and reported", () => {
  const store = useMomentStore.getState();
  store.reportAchievements("u1", computeAchievements(EMPTY));
  const rows = computeAchievements({ ...EMPTY, reviewsWritten: 1 });
  const unlocks = store.reportAchievements("u1", rows);
  assert.equal(unlocks.length, 1);
  assert.deepEqual(
    useMomentStore.getState().queue.map((moment) => moment.id),
    ["critic-1"],
  );
  const event = getTrackedAnalyticsEvents().find((item) => item.event === "achievement_unlocked");
  assert.deepEqual(event?.properties, { achievement_id: "critic", level: 1, total_levels: 4 });

  // The same data again celebrates nothing more.
  assert.deepEqual(store.reportAchievements("u1", rows), []);
  assert.equal(useMomentStore.getState().queue.length, 1);
});

test("diners are baselined separately", () => {
  const store = useMomentStore.getState();
  store.reportAchievements("u1", computeAchievements(EMPTY));
  const unlocks = store.reportAchievements(
    "u2",
    computeAchievements({ ...EMPTY, reviewsWritten: 1 }),
  );
  assert.deepEqual(unlocks, []);
});

test("enqueue ignores a moment already waiting and dismiss moves to the next", () => {
  const store = useMomentStore.getState();
  store.enqueue({ kind: "stamp", id: "a", stampId: "a" });
  store.enqueue({ kind: "stamp", id: "a", stampId: "a" });
  store.enqueue({ kind: "stamp", id: "b", stampId: "b" });
  assert.deepEqual(
    useMomentStore.getState().queue.map((moment) => moment.id),
    ["a", "b"],
  );
  store.dismissCurrent();
  assert.deepEqual(
    useMomentStore.getState().queue.map((moment) => moment.id),
    ["b"],
  );
});
