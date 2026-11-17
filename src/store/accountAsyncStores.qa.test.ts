import assert from "node:assert/strict";
import { test } from "node:test";
import { hungryService } from "@/lib/services/mock/mockService";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { mockUserFoodCred } from "@/lib/services/mock/data";
import { setServiceProvider, resetServiceProvider } from "@/lib/services/serviceProvider";
import { similarityScore } from "@/lib/ai/similarityScore";
import { advanceAccountGeneration } from "@/lib/security/accountScope";
import { useStallFollowStore } from "./useStallFollowStore";
import { useStallSubmissionStore } from "./useStallSubmissionStore";
import { usePassportStore } from "./usePassportStore";
import { useFoodCredStore } from "./useFoodCredStore";
import { useDiscoveryStore } from "./useDiscoveryStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
test("account reset rejects delayed follow list and late optimistic rollback", async () => {
  const load = deferred<string[]>();
  const mutation = deferred<void>();
  const venueId = dataRepositoryMock.listPopularNearby()[0].venueId;
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    similarityScore,
    service: {
      ...hungryService,
      profile: {
        ...hungryService.profile,
        getFollowedStallIds: () => load.promise,
        setStallFollow: () => mutation.promise,
      },
    },
  });
  try {
    useStallFollowStore.getState()._reset();
    const pending = useStallFollowStore.getState().loadFollowedStalls();
    advanceAccountGeneration();
    useStallFollowStore.getState()._reset();
    load.resolve([venueId]);
    await pending;
    assert.deepEqual(useStallFollowStore.getState().followedStallIds, []);
    assert.equal(useStallFollowStore.getState().isLoaded, false);
    useStallFollowStore.setState({ followedStallIds: [venueId] });
    const following = useStallFollowStore.getState().toggleFollow(venueId);
    advanceAccountGeneration();
    useStallFollowStore.getState()._reset();
    mutation.reject(new Error("delayed failure"));
    await assert.rejects(following, /delayed failure/);
    assert.deepEqual(useStallFollowStore.getState().followedStallIds, []);
  } finally {
    resetServiceProvider();
  }
});

test("submission, passport, and Food Cred loads cannot repopulate cleared account state", async () => {
  const submissions =
    deferred<Awaited<ReturnType<typeof hungryService.contributions.listMyDiscoveredStalls>>>();
  const stamps = deferred<Awaited<ReturnType<typeof hungryService.passport.getPassportStamps>>>();
  const cred = deferred<typeof mockUserFoodCred | null>();
  setServiceProvider({
    mode: "mock",
    similarityScore,
    repository: { ...dataRepositoryMock, getUserFoodCred: () => cred.promise },
    service: {
      ...hungryService,
      contributions: {
        ...hungryService.contributions,
        listMyDiscoveredStalls: () => submissions.promise,
      },
      passport: { ...hungryService.passport, getPassportStamps: () => stamps.promise },
    },
  });
  try {
    useStallSubmissionStore.getState()._reset();
    usePassportStore.getState()._reset();
    useFoodCredStore.getState()._reset();
    const loads = [
      useStallSubmissionStore.getState().loadSubmissions(),
      usePassportStore.getState().loadStamps(),
      useFoodCredStore.getState().loadCredProfile(mockUserFoodCred.userId),
    ];
    advanceAccountGeneration();
    useStallSubmissionStore.getState()._reset();
    usePassportStore.getState()._reset();
    useFoodCredStore.getState()._reset();
    submissions.resolve([]);
    stamps.resolve([]);
    cred.resolve(mockUserFoodCred);
    await Promise.all(loads);
    assert.equal(useStallSubmissionStore.getState().isLoaded, false);
    assert.equal(usePassportStore.getState().isLoaded, false);
    assert.equal(useFoodCredStore.getState().isLoaded, false);
    assert.equal(useFoodCredStore.getState().totalPoints, 0);
  } finally {
    resetServiceProvider();
  }
});

test("discovery reset invalidates queued popular response and account recommendation cache", async () => {
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    similarityScore,
    service: hungryService,
  });
  try {
    const dish = dataRepositoryMock.listPopularNearby()[0];
    useDiscoveryStore.getState().cacheRecommendationSlate("qa-cell", [dish.id]);
    useDiscoveryStore.getState().setDecideForMe(dish);
    const load = useDiscoveryStore.getState().refreshPopularNearby();
    advanceAccountGeneration();
    useDiscoveryStore.getState().clearAccountScopedState();
    await load;
    assert.deepEqual(useDiscoveryStore.getState().popularNearby, []);
    assert.equal(useDiscoveryStore.getState().decideForMe, undefined);
    assert.equal(useDiscoveryStore.getState().getCachedRecommendationSlate("qa-cell"), undefined);
  } finally {
    resetServiceProvider();
  }
});
