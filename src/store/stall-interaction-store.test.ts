import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getDataRepository, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import type { StallInteraction } from "@/types/domain";

const USER = "user-1";
const restores: (() => void)[] = [];

function overrideRepository(overrides: Record<string, unknown>) {
  const repo = getDataRepository() as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const had = Object.prototype.hasOwnProperty.call(repo, key);
    const original = repo[key];
    repo[key] = value;
    restores.push(() => {
      if (had) repo[key] = original;
      else delete repo[key];
    });
  }
}

function interaction(stallId: string, patch: Partial<StallInteraction> = {}): StallInteraction {
  return { userId: USER, stallId, isSaved: false, isTried: false, isReviewed: false, ...patch };
}

beforeEach(() => {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useStallInteractionStore.getState()._reset();
  useFoodCredStore.setState({
    totalPoints: 150,
    levelIndex: 1,
    lastEarnedPoints: 0,
    isLoaded: false,
  });
  clearTrackedAnalyticsEvents();
});

afterEach(() => {
  while (restores.length) restores.pop()?.();
});

const store = () => useStallInteractionStore.getState();

test("loadInteractions indexes by stall, runs once, and survives a repository without the method", async () => {
  let reads = 0;
  overrideRepository({
    listStallInteractions: async () => {
      reads += 1;
      return [interaction("s1", { isSaved: true }), interaction("s2", { isTried: true })];
    },
  });
  await store().loadInteractions(USER);
  await store().loadInteractions(USER);

  assert.equal(reads, 1);
  assert.deepEqual(store().getSavedStallIds(), ["s1"]);
  assert.deepEqual(store().getTriedStallIds(), ["s2"]);
  assert.equal(store().getInteraction("missing"), null);

  store()._reset();
  overrideRepository({ listStallInteractions: undefined });
  await store().loadInteractions(USER);
  assert.equal(store().isLoaded, true);
  assert.deepEqual(store().getSavedStallIds(), []);
});

test("saving a stall is optimistic, awards cred once, and unsaving awards nothing", async () => {
  await store().toggleSaved(USER, "s1");
  assert.equal(store().getInteraction("s1")?.isSaved, true);
  assert.ok(store().getInteraction("s1")?.savedAt);
  assert.equal(useFoodCredStore.getState().totalPoints, 152);
  assert.deepEqual(
    getTrackedAnalyticsEvents().map((event) => event.event),
    ["food_cred_earned", "stall_saved"],
  );

  clearTrackedAnalyticsEvents();
  await store().toggleSaved(USER, "s1");
  assert.equal(store().getInteraction("s1")?.isSaved, false);
  assert.equal(useFoodCredStore.getState().totalPoints, 152);
  assert.deepEqual(getTrackedAnalyticsEvents(), []);
});

test("saves past the daily cred cutoff still persist but earn nothing", async () => {
  for (let i = 0; i < 10; i += 1) await store().toggleSaved(USER, `s${i}`);
  assert.equal(useFoodCredStore.getState().totalPoints, 150 + 10 * 2);

  await store().toggleSaved(USER, "s10");
  assert.equal(store().getInteraction("s10")?.isSaved, true);
  assert.equal(useFoodCredStore.getState().totalPoints, 170);
});

test("tried marks earn cred for exactly the first five of the day", async () => {
  for (let i = 0; i < 7; i += 1) await store().markTried(USER, `t${i}`);
  assert.equal(useFoodCredStore.getState().totalPoints, 150 + 5 * 5);
  assert.equal(store().getTriedStallIds().length, 7);
});

test("a failed save rolls the button back and rethrows; unrelated stalls are untouched", async () => {
  await store().toggleSaved(USER, "keep");
  overrideRepository({
    upsertStallInteraction: async () => {
      throw new Error("offline");
    },
  });

  await assert.rejects(() => store().toggleSaved(USER, "s1"), /offline/);
  assert.equal(store().getInteraction("s1"), null);
  assert.equal(store().getInteraction("keep")?.isSaved, true);

  // Rolling back an existing row restores the previous state, not an empty one.
  await assert.rejects(() => store().toggleSaved(USER, "keep"), /offline/);
  assert.equal(store().getInteraction("keep")?.isSaved, true);
});

test("a rollback never overwrites a newer write to the same stall", async () => {
  let release: () => void = () => {};
  overrideRepository({
    upsertStallInteraction: () =>
      new Promise((_, reject) => {
        release = () => reject(new Error("late failure"));
      }),
  });
  const pending = store().toggleSaved(USER, "s1");
  const newer = interaction("s1", { isSaved: true, isTried: true });
  useStallInteractionStore.setState({ interactions: { s1: newer } });
  release();
  await assert.rejects(() => pending, /late failure/);
  assert.equal(store().getInteraction("s1"), newer);
});

test("the server's row replaces the optimistic one", async () => {
  const serverRow = interaction("s1", { isSaved: true, savedAt: "2026-10-22T00:00:00.000Z" });
  overrideRepository({ upsertStallInteraction: async () => serverRow });
  await store().toggleSaved(USER, "s1");
  assert.equal(store().getInteraction("s1"), serverRow);
});

test("marking tried awards cred and reports it; marking again un-tries without cred", async () => {
  const first = await store().markTried(USER, "s1", "DishDetail");
  assert.deepEqual(first, { isTried: true, pointsAwarded: 5 });
  assert.ok(store().getInteraction("s1")?.triedAt);
  assert.equal(
    getTrackedAnalyticsEvents().find((event) => event.event === "stall_marked_tried")?.properties
      .source_screen,
    "DishDetail",
  );

  clearTrackedAnalyticsEvents();
  const second = await store().markTried(USER, "s1");
  assert.deepEqual(second, { isTried: false, pointsAwarded: 0 });
  assert.equal(store().getInteraction("s1")?.triedAt, undefined);
  assert.equal(useFoodCredStore.getState().totalPoints, 155);
  assert.deepEqual(getTrackedAnalyticsEvents(), []);
});

test("pointsAwarded reports what the server actually credited, which can be zero", async () => {
  overrideRepository({
    awardFoodCred: async () => ({ totalPoints: 150, levelIndex: 1, pointsAwarded: 0 }),
  });
  const result = await store().markTried(USER, "s1");
  assert.deepEqual(result, { isTried: true, pointsAwarded: 0 });
});

test("a failed tried write rolls back and awards nothing", async () => {
  overrideRepository({
    upsertStallInteraction: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(() => store().markTried(USER, "s1"), /offline/);
  assert.equal(store().getInteraction("s1"), null);
  assert.equal(useFoodCredStore.getState().totalPoints, 150);
});

test("markReviewed is idempotent and keeps saved and tried state", async () => {
  await store().toggleSaved(USER, "s1");
  let writes = 0;
  overrideRepository({
    upsertStallInteraction: async () => {
      writes += 1;
      return null;
    },
  });
  await store().markReviewed(USER, "s1");
  await store().markReviewed(USER, "s1");

  assert.equal(writes, 1);
  const row = store().getInteraction("s1");
  assert.equal(row?.isReviewed, true);
  assert.equal(row?.isSaved, true);
  assert.ok(row?.reviewedAt);
});
