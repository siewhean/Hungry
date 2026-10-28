// Behaviour checks for the round-three onboarding fixes: when onboarding_completed fires,
// the openness default flag, and guest dish saves before sign-up.

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  clearPendingDishSave,
  flushPendingDishSave,
  forgetPendingDishSave,
  getPendingDishSaveIds,
  rememberPendingDishSave,
} from "@/features/auth/pendingDishSave";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail } from "@/types/domain";

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((record) => record.event === name);

beforeEach(() => {
  clearTrackedAnalyticsEvents();
  clearPendingDishSave();
  useUIStore.setState({ toast: null });
  useSessionStore.setState({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    hasSkippedTasteQuiz: false,
    onboardingCompletionPending: false,
  });
});

test("ONB-2: finishing onboarding signed out sends onboarding_completed only once auth succeeds", () => {
  useSessionStore.getState().completeOnboarding(true);
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  assert.equal(useSessionStore.getState().onboardingCompletionPending, true);
  assert.equal(events("onboarding_completed").length, 0, "nothing before an account exists");

  useSessionStore.getState().completeAuth({ completedOnboarding: true, isNewUser: true });
  useSessionStore.getState().completeAuth({ completedOnboarding: true });
  const completions = events("onboarding_completed");
  assert.equal(completions.length, 1);
  assert.equal(completions[0]?.properties.skipped_quiz, true);
  assert.equal(useSessionStore.getState().onboardingCompletionPending, false);
});

test("ONB-2, ONB-3: Welcome's sign-in intent is not an onboarding completion", () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, false);
  assert.equal(useSessionStore.getState().onboardingCompletionPending, false);
  useSessionStore.getState().completeAuth();
  assert.equal(events("onboarding_completed").length, 0);
});

test("ONB-2: a session restored from storage also sends the pending completion once", () => {
  useSessionStore.getState().completeOnboarding(false);
  const profile = useProfileStore.getState().profile;
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: profile.id,
  });
  assert.equal(events("onboarding_completed").length, 1);
});

test("ONB-X4: food_openness_set says whether the preselected answer was changed", () => {
  useProfileStore.getState().setFoodOpenness("mix", "onboarding", { changedFromDefault: false });
  useProfileStore
    .getState()
    .setFoodOpenness("adventurous", "onboarding", { changedFromDefault: true });
  const [kept, changed] = events("food_openness_set");
  assert.equal(kept?.properties.changed_from_default, false);
  assert.equal(changed?.properties.changed_from_default, true);
});

const dish = (id: string, name: string) => ({ id, name }) as DishDetail;

function stubSaves(options: { fail?: string[] } = {}) {
  const calls: string[] = [];
  let writes = 0;
  let serverReads = 0;
  const originalAdd = useProfileStore.getState().addFavourites;
  useProfileStore.setState({
    addFavourites: async (targets) => {
      writes += 1;
      calls.push(...targets.map((target) => target.id));
      return targets.filter((target) => options.fail?.includes(target.id));
    },
  });
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...current, favouriteDishIds: [] } });
  const profileService = getHungryService().profile;
  const originalIds = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = async () => {
    serverReads += 1;
    return [];
  };
  return {
    calls,
    writes: () => writes,
    serverReads: () => serverReads,
    restore: () => {
      useProfileStore.setState({ addFavourites: originalAdd });
      profileService.getFavouriteDishIds = originalIds;
    },
  };
}

test("ONB-4: every dish a guest hearts is kept (deduped) and saved after sign-up, with one read", async () => {
  const stub = stubSaves();
  try {
    rememberPendingDishSave(dish("d1", "Chicken Rice"));
    rememberPendingDishSave(dish("d2", "Laksa"));
    rememberPendingDishSave(dish("d1", "Chicken Rice"));
    rememberPendingDishSave(dish("d3", "Satay"));
    forgetPendingDishSave("d3");
    assert.deepEqual(getPendingDishSaveIds(), ["d2", "d1"]);
    await flushPendingDishSave();
    assert.deepEqual(stub.calls, ["d2", "d1"]);
    assert.equal(stub.serverReads(), 1, "the account's saves are read once, not per dish");
    assert.equal(stub.writes(), 1, "and written once, not per dish (ONB-V6)");
    assert.equal(useUIStore.getState().toast?.message, "Saved 2 dishes");
  } finally {
    stub.restore();
  }
});

test("ONB-X10: a save that fails after sign-up shows an error, not 'Saved'", async () => {
  const stub = stubSaves({ fail: ["d1"] });
  try {
    rememberPendingDishSave(dish("d1", "Chicken Rice"));
    await flushPendingDishSave();
    assert.equal(useUIStore.getState().toast?.tone, "error");
    assert.match(useUIStore.getState().toast?.message ?? "", /Couldn't save Chicken Rice/);
  } finally {
    stub.restore();
  }
});

test("ONB-X2: a cleared guest save is never attached to the next account", async () => {
  const stub = stubSaves();
  try {
    rememberPendingDishSave(dish("d1", "Chicken Rice"));
    clearPendingDishSave();
    await flushPendingDishSave();
    assert.deepEqual(stub.calls, []);

    rememberPendingDishSave(dish("d2", "Laksa"));
    useSessionStore.setState({ isAuthenticated: true });
    useSessionStore.getState().signOut();
    assert.deepEqual(getPendingDishSaveIds(), [], "sign-out drops a remembered save");
  } finally {
    stub.restore();
  }
});

test("ONB-X6: a provider failure is logged against the tab the user was on", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/app/screens/onboarding/OnboardingAuthScreen.tsx", "utf8");
  assert.match(
    source,
    /trackAuthFailed\(tab === "login" \? "sign_in" : "sign_up", provider, err\)/,
  );
  assert.doesNotMatch(source, /trackAuthFailed\("sign_up", provider, err\)/);
});
