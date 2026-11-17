import assert from "node:assert/strict";
import test from "node:test";
import { dishes, userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { HungryService } from "@/lib/services/types";
import { hungryPersistStorage } from "./persistStorage";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";
import { useUIStore } from "./useUIStore";

const userId = "11111111-1111-4111-8111-111111111111";
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function install(
  profile: Partial<HungryService["profile"]>,
  feedback?: HungryService["recommendations"]["recordExplicitFeedback"],
) {
  setConfiguredDataSource("supabase");
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    similarityScore: () => 1,
    service: {
      profile,
      recommendations: { recordExplicitFeedback: feedback ?? (async () => undefined) },
    } as unknown as HungryService,
  });
  useSessionStore.setState({
    isAuthenticated: true,
    authenticatedUserId: userId,
    authDataSource: "supabase",
  });
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: userId,
      favouriteDishIds: [],
      stats: { ...userProfile.stats, favouritesCount: 0 },
    },
    tasteInteractionEvents: [],
  });
}

test.afterEach(() => {
  resetServiceProvider();
  setConfiguredDataSource("mock");
  useSessionStore.setState({
    isAuthenticated: false,
    authenticatedUserId: null,
    hasCompletedOnboarding: false,
    guestOnboardingCompleted: false,
  });
  useUIStore.setState({ allowSearchHistory: true });
});

test("CR-S04: signed-out returning-user routing does not complete the next account's onboarding", async () => {
  useSessionStore.setState({
    isAuthenticated: true,
    authenticatedUserId: userProfile.id,
    hasCompletedOnboarding: true,
    guestOnboardingCompleted: false,
  });
  await useSessionStore.getState().signOut();
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  useProfileStore.setState({ profile: { ...userProfile, id: "next-account" } });
  useSessionStore
    .getState()
    .completeAuth({ userId: "next-account", completedOnboarding: false, trackSignInEvent: false });
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, false);
});

test("CR-S04: genuine guest onboarding survives auth event then interactive completion", () => {
  useSessionStore.setState({
    isAuthenticated: false,
    authenticatedUserId: null,
    hasCompletedOnboarding: false,
    guestOnboardingCompleted: false,
  });
  useSessionStore.getState().completeOnboarding();
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: userProfile.id,
    completedOnboarding: false,
  });
  useSessionStore.getState().completeAuth({ completedOnboarding: false, trackSignInEvent: false });
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  assert.equal(useSessionStore.getState().guestOnboardingCompleted, false);
});

for (const failure of [new SyntaxError("malformed metadata"), new Error("read rejected")]) {
  test(`CR-S05: hydration finishes application and middleware waiters after ${failure.name}`, async () => {
    assert.ok(hungryPersistStorage);
    const read = hungryPersistStorage.getItem;
    const warn = console.warn;
    console.warn = () => undefined;
    hungryPersistStorage.getItem = async () => {
      throw failure;
    };
    let finished = false;
    const unsubscribe = useSessionStore.persist.onFinishHydration(() => {
      finished = true;
    });
    try {
      useSessionStore.setState({
        hasHydrated: false,
        isAuthenticated: false,
        authenticatedUserId: null,
      });
      await useSessionStore.persist.rehydrate();
      assert.equal(useSessionStore.getState().hasHydrated, true);
      assert.equal(useSessionStore.persist.hasHydrated(), true);
      assert.equal(finished, true);
      assert.equal(useSessionStore.getState().isAuthenticated, false);
    } finally {
      hungryPersistStorage.getItem = read;
      console.warn = warn;
      unsubscribe();
    }
  });
}

test("CR-S06: failed favourite restores its fields and toast while retaining budget changes", async () => {
  const write = deferred<boolean>();
  install({ toggleFavourite: () => write.promise });
  const before = useProfileStore.getState();
  const error = console.error;
  console.error = () => undefined;
  try {
    useProfileStore.getState().toggleFavourite(dishes[0]);
    useProfileStore.getState().setMaxDishBudget(12);
    write.reject(new Error("rejected save"));
    await tick();
    const state = useProfileStore.getState();
    assert.deepEqual(state.profile.favouriteDishIds, []);
    assert.equal(state.profile.stats.favouritesCount, 0);
    assert.deepEqual(state.profile.tasteVector, before.profile.tasteVector);
    assert.deepEqual(state.tasteInteractionEvents, before.tasteInteractionEvents);
    assert.equal(state.profile.maxDishBudget, 12);
    assert.equal(useUIStore.getState().toast?.tone, "error");
  } finally {
    console.error = error;
  }
});

test("CR-S06: failed display-name write retains an unrelated successful email", async () => {
  const write = deferred<void>();
  install({
    updateProfile: (input) =>
      input.displayName ? write.promise : Promise.resolve(useProfileStore.getState().profile),
  } as Partial<HungryService["profile"]>);
  const oldName = useProfileStore.getState().profile.displayName;
  const error = console.error;
  console.error = () => undefined;
  try {
    useProfileStore.getState().updateProfile({ displayName: "Rejected" });
    useProfileStore.getState().updateProfile({ email: "kept@example.test" });
    write.reject(new Error("rejected name"));
    await tick();
    assert.equal(useProfileStore.getState().profile.displayName, oldName);
    assert.equal(useProfileStore.getState().profile.email, "kept@example.test");
  } finally {
    console.error = error;
  }
});

test("CR-S07: query opt-out strips queries from local events, persistence and feedback but retains click signals", async () => {
  const payloads: unknown[] = [];
  install({}, async (payload) => {
    payloads.push(payload);
    return { tasteVector: userProfile.tasteVector, applied: true };
  });
  useUIStore.setState({ allowSearchHistory: false });
  const event = useProfileStore.getState().recordTasteInteraction({
    type: "dish_result_click",
    surface: "search",
    dish: dishes[0],
    query: "private query",
  });
  assert.equal(event?.query, undefined);
  assert.equal(event?.type, "dish_result_click");
  assert.equal(event?.applied, true);
  assert.ok(
    !JSON.stringify(useProfileStore.getState().tasteInteractionEvents).includes("private query"),
  );
  const partialize = useProfileStore.persist.getOptions().partialize!;
  assert.ok(!JSON.stringify(partialize(useProfileStore.getState())).includes("private query"));
  assert.ok(!JSON.stringify(payloads).includes("private query"));
  assert.equal(payloads.length, 1);
  assert.equal(
    useProfileStore
      .getState()
      .recordTasteInteraction({ type: "search_query", surface: "search", query: "private query" }),
    undefined,
  );
});

for (const initiallySaved of [false, true]) {
  test(`CR-S08: stale favourite load does not undo a confirmed ${initiallySaved ? "removal" : "save"}`, async () => {
    const load = deferred<string[]>();
    install({
      getFavouriteDishIds: () => load.promise,
      setFavourite: async (_id, desired) => desired,
    });
    useProfileStore.setState((state) => ({
      profile: { ...state.profile, favouriteDishIds: initiallySaved ? [dishes[0].id] : [] },
    }));
    useProfileStore.getState().syncProfile(true, userId);
    await useProfileStore.getState().setFavourite(dishes[0].id, !initiallySaved);
    load.resolve(initiallySaved ? [dishes[0].id] : []);
    await tick();
    assert.deepEqual(
      useProfileStore.getState().profile.favouriteDishIds,
      initiallySaved ? [] : [dishes[0].id],
    );
    assert.equal(useProfileStore.getState().profile.stats.favouritesCount, initiallySaved ? 0 : 1);
  });
}

for (const method of ["setTasteVector", "setTasteProfile", "setDietaryPreferences"] as const) {
  test(`CR-S06: ${method} failure restores owned fields without erasing budget`, async () => {
    const write = deferred<never>();
    install({
      updateTasteVector: () => write.promise,
      updateTasteProfile: () => write.promise,
      updateDietaryPreferences: () => write.promise,
    });
    const before = useProfileStore.getState();
    const error = console.error;
    console.error = () => undefined;
    try {
      if (method === "setTasteVector")
        useProfileStore.getState().setTasteVector(dishes[0].tasteVector);
      else if (method === "setTasteProfile")
        useProfileStore
          .getState()
          .setTasteProfile({ ...before.tasteProfile, vector: dishes[0].tasteVector });
      else useProfileStore.getState().setDietaryPreferences(["halal"]);
      useProfileStore.getState().setMaxDishBudget(17);
      write.reject(new Error("rejected preference"));
      await tick();
      assert.deepEqual(useProfileStore.getState().profile.tasteVector, before.profile.tasteVector);
      assert.deepEqual(
        useProfileStore.getState().profile.dietaryPreferences,
        before.profile.dietaryPreferences,
      );
      assert.deepEqual(useProfileStore.getState().tasteProfile, before.tasteProfile);
      assert.equal(useProfileStore.getState().profile.maxDishBudget, 17);
    } finally {
      console.error = error;
    }
  });
}

test("CR-S06: a newer same-value successful field write owns rollback", async () => {
  const first = deferred<never>();
  let calls = 0;
  install({
    updateProfile: async () => {
      if (++calls === 1) return first.promise;
      return useProfileStore.getState().profile;
    },
  });
  const error = console.error;
  console.error = () => undefined;
  try {
    useProfileStore.getState().updateProfile({ displayName: "Kept" });
    useProfileStore.getState().updateProfile({ displayName: "Kept" });
    first.reject(new Error("older rejection"));
    await tick();
    assert.equal(useProfileStore.getState().profile.displayName, "Kept");
  } finally {
    console.error = error;
  }
});

test("CR-S06: rejected dish save does not remove another successful dish save", async () => {
  const first = deferred<boolean>();
  install({
    toggleFavourite: (id) => (id === dishes[0].id ? first.promise : Promise.resolve(true)),
  });
  const error = console.error;
  console.error = () => undefined;
  try {
    useProfileStore.getState().toggleFavourite(dishes[0]);
    useProfileStore.getState().toggleFavourite(dishes[1]);
    await tick();
    first.reject(new Error("first rejected"));
    await tick();
    assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, [dishes[1].id]);
    assert.equal(useProfileStore.getState().profile.stats.favouritesCount, 1);
  } finally {
    console.error = error;
  }
});
