import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_ACTIVE_MISSIONS } from "@/constants/missionTemplates";
import { advanceAccountGeneration } from "@/lib/security/accountScope";
import {
  mockStallInteractions,
  mockUserMissionProgress,
  userProfile,
} from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import { useFoodCredStore } from "./useFoodCredStore";
import { useMissionStore } from "./useMissionStore";
import { useStallInteractionStore } from "./useStallInteractionStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function repository(overrides: Partial<DataRepository>) {
  setServiceProvider({
    mode: "mock",
    service: hungryService,
    similarityScore: () => 1,
    repository: { ...dataRepositoryMock, ...overrides },
  });
}
const mission = MOCK_ACTIVE_MISSIONS.find((m) => m.id === mockUserMissionProgress[0].missionId)!;
const initialProgress = mockUserMissionProgress[0];
const originalAward = useFoodCredStore.getState().awardPoints;

test.afterEach(() => {
  useMissionStore.getState()._reset();
  useStallInteractionStore.getState()._reset();
  useFoodCredStore.getState()._reset();
  useFoodCredStore.setState({ awardPoints: originalAward });
  resetServiceProvider();
});

test("CR-S10: a replaced account load cannot adopt the next account's mission generation", async () => {
  const firstLoad = deferred<typeof MOCK_ACTIVE_MISSIONS>();
  const mutationUsers: string[] = [];
  let loads = 0;
  repository({
    listActiveMissions: () => (++loads === 1 ? firstLoad.promise : Promise.resolve([mission])),
    listUserMissionProgress: async () => [],
    incrementMissionProgress: async (userId) => {
      mutationUsers.push(userId);
    },
  });
  const increment = useMissionStore
    .getState()
    .incrementProgress(userProfile.id, mission.missionType);
  advanceAccountGeneration();
  useMissionStore.getState()._reset();
  const replacementUser = mockStallInteractions[1].stallId;
  await useMissionStore.getState().loadMissions(replacementUser);
  firstLoad.resolve([mission]);
  await increment;
  assert.deepEqual(mutationUsers, []);
  assert.equal(useMissionStore.getState().progressMap[mission.id].userId, replacementUser);
  assert.equal(useMissionStore.getState().progressMap[mission.id].currentCount, 0);
});

test("CR-S10: concurrent loads for one account/week share a single repository request", async () => {
  const pending = deferred<typeof MOCK_ACTIVE_MISSIONS>();
  let loads = 0;
  repository({
    listActiveMissions: () => {
      loads += 1;
      return pending.promise;
    },
    listUserMissionProgress: async () => [],
  });
  const one = useMissionStore.getState().loadMissions(userProfile.id);
  const two = useMissionStore.getState().loadMissions(userProfile.id);
  assert.equal(loads, 1);
  pending.resolve([mission]);
  await Promise.all([one, two]);
  assert.equal(useMissionStore.getState().isLoaded, true);
});

test("CR-S11: concurrent local completion awards the mission bonus once", async () => {
  const reward = deferred<number>();
  let awards = 0;
  repository({
    incrementMissionProgress: undefined,
    awardFoodCred: undefined,
    listActiveMissions: async () => [mission],
    listUserMissionProgress: async () => [initialProgress],
  });
  useFoodCredStore.setState({
    totalPoints: 0,
    awardPoints: async () => {
      awards += 1;
      return reward.promise;
    },
  });
  const first = useMissionStore.getState().incrementProgress(userProfile.id, mission.missionType);
  const second = useMissionStore.getState().incrementProgress(userProfile.id, mission.missionType);
  // Let both callers reach the deliberately held reward boundary.
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(awards, 1);
  reward.resolve(0);
  await Promise.all([first, second]);
  assert.equal(awards, 1);
  assert.equal(useFoodCredStore.getState().totalPoints, mission.rewardValue);
  assert.equal(
    useMissionStore.getState().progressMap[mission.id].currentCount,
    mission.requirementCount,
  );
  assert.ok(useMissionStore.getState().progressMap[mission.id].completedAt);
});

test("CR-S11: concurrent local actions both advance an incomplete mission", async () => {
  repository({
    incrementMissionProgress: undefined,
    awardFoodCred: undefined,
    listActiveMissions: async () => [mission],
    listUserMissionProgress: async () => [],
  });
  await Promise.all([
    useMissionStore.getState().incrementProgress(userProfile.id, mission.missionType),
    useMissionStore.getState().incrementProgress(userProfile.id, mission.missionType),
  ]);
  assert.equal(useMissionStore.getState().progressMap[mission.id].currentCount, 2);
});

test("CR-S11: reset during reward completion cannot add a bonus to the replacement account", async () => {
  const reward = deferred<number>();
  repository({
    incrementMissionProgress: undefined,
    listActiveMissions: async () => [mission],
    listUserMissionProgress: async () => [initialProgress],
  });
  useFoodCredStore.setState({ totalPoints: 0, awardPoints: () => reward.promise });
  const increment = useMissionStore
    .getState()
    .incrementProgress(userProfile.id, mission.missionType);
  await new Promise<void>((done) => setImmediate(done));
  advanceAccountGeneration();
  useMissionStore.getState()._reset();
  useFoodCredStore.getState()._reset();
  reward.resolve(0);
  await increment;
  assert.equal(useFoodCredStore.getState().totalPoints, 0);
  assert.deepEqual(useMissionStore.getState().progressMap, {});
});

test("CR-S15: a review response cannot repopulate a replacement account", async () => {
  const pending = deferred<(typeof mockStallInteractions)[number]>();
  repository({ upsertStallInteraction: () => pending.promise });
  const fixture = mockStallInteractions[1];
  const marking = useStallInteractionStore.getState().markReviewed(fixture.userId, fixture.stallId);
  assert.equal(useStallInteractionStore.getState().interactions[fixture.stallId].isReviewed, true);
  advanceAccountGeneration();
  useStallInteractionStore.getState()._reset();
  pending.resolve({ ...fixture, isReviewed: true });
  await assert.rejects(marking, /account changed/);
  assert.deepEqual(useStallInteractionStore.getState().interactions, {});
});
