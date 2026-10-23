import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  FOOD_CRED_LEVELS,
  FOOD_CRED_POINTS,
  resolveFoodCredLevel,
  resolveLevelProgress,
} from "@/constants/foodCredConfig";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { getDataRepository, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useMissionStore } from "@/store/useMissionStore";
import type { UserMissionProgress, WeeklyMission } from "@/types/domain";

type RepoOverrides = Record<string, unknown>;
const restores: (() => void)[] = [];

/** Replaces repository methods for one test; afterEach puts the originals back. */
function overrideRepository(overrides: RepoOverrides) {
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

beforeEach(() => {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useFoodCredStore.setState({
    totalPoints: 150,
    levelIndex: 1,
    lastEarnedPoints: 0,
    isLoaded: false,
  });
  useMissionStore.getState()._reset();
  clearTrackedAnalyticsEvents();
});

afterEach(() => {
  while (restores.length) restores.pop()?.();
});

function eventNames() {
  return getTrackedAnalyticsEvents().map((event) => event.event);
}

function mission(overrides: Partial<WeeklyMission> = {}): WeeklyMission {
  return {
    id: "m-1",
    title: "Try two stalls",
    description: "",
    missionType: "try_stalls",
    requirementCount: 2,
    rewardType: "food_cred",
    rewardValue: 20,
    weekStart: "2026-10-19",
    weekEnd: "2026-10-25",
    isActive: true,
    ...overrides,
  } as WeeklyMission;
}

test("levels are ascending, start at zero, and resolve at exact thresholds", () => {
  assert.equal(FOOD_CRED_LEVELS[0].minPoints, 0);
  for (let i = 1; i < FOOD_CRED_LEVELS.length; i += 1) {
    assert.ok(FOOD_CRED_LEVELS[i].minPoints > FOOD_CRED_LEVELS[i - 1].minPoints);
    assert.equal(FOOD_CRED_LEVELS[i].index, i);
    assert.equal(resolveFoodCredLevel(FOOD_CRED_LEVELS[i].minPoints).index, i);
    assert.equal(resolveFoodCredLevel(FOOD_CRED_LEVELS[i].minPoints - 1).index, i - 1);
  }
  assert.equal(resolveFoodCredLevel(-5).index, 0);
  assert.equal(resolveLevelProgress(0), 0);
  assert.equal(resolveLevelProgress(125), 0.5);
  assert.equal(resolveLevelProgress(100000), 1);
});

test("awarding points locally adds the configured amount and reports a level change", async () => {
  const store = useFoodCredStore.getState();
  assert.equal(store.currentLevel().name, "Regular");

  const total = await store.awardPoints("review_created", "r1");
  assert.equal(total, 150 + FOOD_CRED_POINTS.review_created);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, FOOD_CRED_POINTS.review_created);
  assert.deepEqual(eventNames(), ["food_cred_earned"]);

  // 165 -> 200 crosses into Reviewer.
  useFoodCredStore.setState({ totalPoints: 198, levelIndex: 1 });
  clearTrackedAnalyticsEvents();
  await useFoodCredStore.getState().awardPoints("stall_marked_tried");
  assert.equal(useFoodCredStore.getState().levelIndex, 2);
  assert.deepEqual(eventNames(), ["food_cred_earned", "food_cred_level_changed"]);
});

test("an action worth zero points changes nothing and tracks nothing", async () => {
  const total = await useFoodCredStore.getState().awardPoints("mission_completed", "m-1");
  assert.equal(total, 150);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, 0);
  assert.deepEqual(eventNames(), []);
});

test("the server's award wins over local math when the repository answers", async () => {
  overrideRepository({
    awardFoodCred: async () => ({ totalPoints: 999, levelIndex: 3, pointsAwarded: 7 }),
  });
  const total = await useFoodCredStore.getState().awardPoints("post_created", "p1");
  assert.equal(total, 999);
  assert.equal(useFoodCredStore.getState().levelIndex, 3);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, 7);
  const [event] = getTrackedAnalyticsEvents();
  assert.equal(event.properties.new_total, 999);
  assert.equal(event.properties.new_level, "Specialist");
});

test("adjustPoints reverses points, never goes below zero, and tracks level drops", async () => {
  useFoodCredStore.setState({ totalPoints: 52, levelIndex: 1 });
  assert.equal(await useFoodCredStore.getState().adjustPoints(0), 52);
  assert.deepEqual(eventNames(), []);

  assert.equal(await useFoodCredStore.getState().adjustPoints(-5, "s1", "stall_marked_tried"), 47);
  assert.equal(useFoodCredStore.getState().levelIndex, 0);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, 0);
  assert.deepEqual(eventNames(), ["food_cred_adjusted", "food_cred_level_changed"]);

  assert.equal(await useFoodCredStore.getState().adjustPoints(-1000), 0);
  assert.equal(await useFoodCredStore.getState().adjustPoints(10), 10);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, 10);
});

test("loadCredProfile hydrates once and tolerates a missing profile", async () => {
  let calls = 0;
  overrideRepository({
    getUserFoodCred: async () => {
      calls += 1;
      return { userId: "u1", totalPoints: 320, levelIndex: 2 };
    },
  });
  await useFoodCredStore.getState().loadCredProfile("u1");
  await useFoodCredStore.getState().loadCredProfile("u1");
  assert.equal(calls, 1);
  assert.equal(useFoodCredStore.getState().totalPoints, 320);
  assert.equal(useFoodCredStore.getState().isLoaded, true);

  useFoodCredStore.getState()._reset();
  overrideRepository({ getUserFoodCred: async () => null });
  await useFoodCredStore.getState().loadCredProfile("ghost");
  assert.equal(useFoodCredStore.getState().isLoaded, true);
  assert.equal(useFoodCredStore.getState().totalPoints, 0);
});

test("loadMissions seeds a zero-progress row for every mission without one, and loads once", async () => {
  let loads = 0;
  const existing: UserMissionProgress = { userId: "u1", missionId: "m-1", currentCount: 1 };
  overrideRepository({
    listActiveMissions: async () => {
      loads += 1;
      return [mission(), mission({ id: "m-2", missionType: "write_review" })];
    },
    listUserMissionProgress: async () => [existing],
  });
  await useMissionStore.getState().loadMissions("u1");
  await useMissionStore.getState().loadMissions("u1");

  const state = useMissionStore.getState();
  assert.equal(loads, 1);
  assert.equal(state.getProgress("m-1")?.currentCount, 1);
  assert.deepEqual(state.getProgress("m-2"), { userId: "u1", missionId: "m-2", currentCount: 0 });
  assert.equal(state.getMission("nope"), null);
  assert.equal(state.getProgress("nope"), null);
  assert.equal(state.getActiveMissions().length, 2);
  assert.equal(state.getCompletedMissions().length, 0);
});

test("incrementProgress completes a mission once, awards cred plus the bonus, and ignores other types", async () => {
  overrideRepository({
    listActiveMissions: async () => [mission()],
    listUserMissionProgress: async () => [],
  });
  await useMissionStore.getState().loadMissions("u1");

  await useMissionStore.getState().incrementProgress("u1", "write_review" as never);
  assert.equal(useMissionStore.getState().getProgress("m-1")?.currentCount, 0);

  await useMissionStore.getState().incrementProgress("u1", "try_stalls" as never);
  assert.equal(useMissionStore.getState().getProgress("m-1")?.currentCount, 1);
  assert.equal(useMissionStore.getState().getCompletedMissions().length, 0);

  await useMissionStore.getState().incrementProgress("u1", "try_stalls" as never);
  const done = useMissionStore.getState();
  assert.equal(done.getProgress("m-1")?.currentCount, 2);
  assert.ok(done.getProgress("m-1")?.completedAt);
  assert.equal(done.getCompletedMissions().length, 1);
  assert.equal(done.getActiveMissions().length, 0);
  // mission_completed is worth 0 by default, so only the mission's own bonus lands.
  assert.equal(useFoodCredStore.getState().totalPoints, 150 + 20);
  assert.equal(useFoodCredStore.getState().lastEarnedPoints, 20);
  assert.ok(eventNames().includes("mission_completed"));

  // A completed mission no longer counts, so cred is never paid twice.
  await useMissionStore.getState().incrementProgress("u1", "try_stalls" as never);
  assert.equal(useMissionStore.getState().getProgress("m-1")?.currentCount, 2);
  assert.equal(useFoodCredStore.getState().totalPoints, 170);
});

test("a repository that tracks missions server-side replaces local state after the increment", async () => {
  const calls: string[] = [];
  overrideRepository({
    incrementMissionProgress: async (_userId: string, type: string) => {
      calls.push(type);
    },
    listActiveMissions: async () => [mission()],
    listUserMissionProgress: async () => [
      { userId: "u1", missionId: "m-1", currentCount: 2, completedAt: "2026-10-22" },
    ],
    getUserFoodCred: async () => ({ userId: "u1", totalPoints: 500, levelIndex: 3 }),
  });
  await useMissionStore.getState().incrementProgress("u1", "try_stalls" as never);

  assert.deepEqual(calls, ["try_stalls"]);
  assert.equal(useMissionStore.getState().getCompletedMissions().length, 1);
  assert.equal(useFoodCredStore.getState().totalPoints, 500);
  assert.equal(useFoodCredStore.getState().levelIndex, 3);
});
