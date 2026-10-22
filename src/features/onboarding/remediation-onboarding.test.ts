import assert from "node:assert/strict";
import test from "node:test";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { userProfile } from "@/lib/services/mock/data";
import { useProfileStore } from "@/store/useProfileStore";
import {
  applySignedInProfile,
  captureGuestProfileSnapshot,
} from "@/features/auth/applySignedInProfile";
import { closestTasteOptionIndex, useOnboardingDraftStore } from "./useOnboardingDraftStore";
import { selectOnboardingRecommendations } from "./recommendationPreview";

test("taste and dietary routes share one resumable draft; cancellation leaves real profile unchanged", () => {
  useOnboardingDraftStore.getState().reset();
  const original = structuredClone(userProfile);
  useProfileStore.setState({ profile: original });
  const draft = useOnboardingDraftStore.getState().prepare(original, "profile");
  const values = { ...draft.values, spicy: 8, sweet: 2 };
  useOnboardingDraftStore.getState().update({ values, step: 5, dietaryPreferences: ["halal"] });
  const dietaryRoute = useOnboardingDraftStore.getState().prepare(original, "profile");
  assert.deepEqual(dietaryRoute.values, values);
  assert.equal(dietaryRoute.step, 5);
  assert.deepEqual(useProfileStore.getState().profile, original);
  assert.deepEqual(closestTasteOptionIndex(8), 2);
  assert.deepEqual(closestTasteOptionIndex(2), 0);
});

test("draft explicitly adopts guest at sign-in, survives same-account resume, and clears on account switch", () => {
  useOnboardingDraftStore.getState().reset();
  const guest = { ...userProfile, id: "guest-user" };
  useOnboardingDraftStore.getState().prepare(guest);
  useOnboardingDraftStore.getState().update({
    cuisineIds: ["local"],
    pendingSaveDishId: getDataRepository().listPopularNearby()[0].id,
  });
  useOnboardingDraftStore.getState().setAccountScope(userProfile.id, { adoptGuest: true });
  assert.equal(useOnboardingDraftStore.getState().draft?.subjectId, userProfile.id);
  assert.deepEqual(useOnboardingDraftStore.getState().draft?.cuisineIds, ["local"]);
  useOnboardingDraftStore.getState().setAccountScope(userProfile.id);
  assert.ok(useOnboardingDraftStore.getState().draft?.pendingSaveDishId);
  useOnboardingDraftStore.getState().setAccountScope(null);
  assert.equal(useOnboardingDraftStore.getState().draft, null);
});

test("guest snapshot survives SIGNED_IN replacement before signIn promise resolves", async () => {
  const guest = {
    ...structuredClone(userProfile),
    id: "guest-user",
    tasteVector: { ...userProfile.tasteVector, spicy: 9 },
    dietaryPreferences: ["halal" as const],
    maxDishBudget: 6,
    onboardingCuisineIds: ["local"],
  };
  useProfileStore.setState({ profile: guest });
  const snapshot = captureGuestProfileSnapshot();
  // The SDK invokes subscribers before resolving sign-in.
  useProfileStore.setState({ profile: structuredClone(userProfile) });
  await applySignedInProfile(structuredClone(userProfile), { guestSnapshot: snapshot });
  assert.equal(useProfileStore.getState().profile.tasteVector.spicy, 9);
  assert.deepEqual(useProfileStore.getState().profile.dietaryPreferences, ["halal"]);
  assert.equal(useProfileStore.getState().profile.maxDishBudget, 6);
  assert.deepEqual(useProfileStore.getState().profile.onboardingCuisineIds, ["local"]);
});

test("all dietary requirements apply before limit and zero matches never restore unrestricted dishes", () => {
  const dish = getDataRepository().listPopularNearby()[0];
  const restricted = {
    ...userProfile,
    dietaryPreferences: ["halal" as const, "vegan" as const],
    maxDishBudget: 6,
  };
  assert.deepEqual(
    selectOnboardingRecommendations([{ ...dish, dietaryFlags: [] }], restricted),
    [],
  );
  assert.deepEqual(
    selectOnboardingRecommendations([{ ...dish, dietaryFlags: ["halal"] }], restricted),
    [],
  );
  const match = { ...dish, dietaryFlags: ["halal" as const, "vegan" as const], price: 5 };
  const results = selectOnboardingRecommendations(
    [{ ...dish, dietaryFlags: [] }, match],
    restricted,
    1,
  );
  assert.deepEqual(results, [match]);
  assert.equal(results[0].imageUrl, dish.imageUrl);
  assert.deepEqual(selectOnboardingRecommendations([{ ...match, price: 8 }], restricted), []);
});

test("queued Save is an idempotent desired state and retained after failure", async () => {
  const { getHungryService } = await import("@/lib/services/serviceProvider");
  const { fulfillPendingOnboardingSave } = await import("./fulfillPendingSave");
  useOnboardingDraftStore.getState().reset();
  useProfileStore.setState({ profile: structuredClone(userProfile) });
  useOnboardingDraftStore.getState().prepare(userProfile);
  const dish = getDataRepository().listPopularNearby()[0];
  useOnboardingDraftStore.getState().update({ pendingSaveDishId: dish.id });
  const service = getHungryService().profile;
  const original = service.setFavourite;
  let calls = 0;
  service.setFavourite = async () => {
    calls += 1;
    throw new Error("Offline");
  };
  try {
    await assert.rejects(fulfillPendingOnboardingSave(), /Offline/);
    assert.equal(useOnboardingDraftStore.getState().draft?.pendingSaveDishId, dish.id);
    service.setFavourite = async (_id, desired) => {
      calls += 1;
      assert.equal(desired, true);
      return true;
    };
    await Promise.all([fulfillPendingOnboardingSave(), fulfillPendingOnboardingSave()]);
    assert.equal(useOnboardingDraftStore.getState().draft?.pendingSaveDishId, undefined);
    assert.equal(calls, 2);
  } finally {
    service.setFavourite = original;
  }
});

test("pending saves are account-generation scoped and a retired completion cannot clear renewed intent", async () => {
  const { advanceAccountGeneration } = await import("@/lib/security/accountScope");
  const { getHungryService } = await import("@/lib/services/serviceProvider");
  const { fulfillPendingOnboardingSave } = await import("./fulfillPendingSave");
  useOnboardingDraftStore.getState().reset();
  useProfileStore.setState({ profile: structuredClone(userProfile) });
  useOnboardingDraftStore.getState().prepare(userProfile);
  const dishId = getDataRepository().listPopularNearby()[0].id;
  useOnboardingDraftStore.getState().update({ pendingSaveDishId: dishId });
  const service = getHungryService().profile;
  const original = service.setFavourite;
  let finishOld!: (saved: boolean) => void;
  let calls = 0;
  service.setFavourite = async () => {
    calls += 1;
    if (calls === 1)
      return new Promise<boolean>((resolve) => {
        finishOld = resolve;
      });
    return true;
  };
  try {
    const old = fulfillPendingOnboardingSave();
    advanceAccountGeneration(); // A -> B -> A, even when the subject string returns to A.
    advanceAccountGeneration();
    finishOld(true);
    await old;
    assert.equal(useOnboardingDraftStore.getState().draft?.pendingSaveDishId, dishId);
    await fulfillPendingOnboardingSave();
    assert.equal(calls, 2);
    assert.equal(useOnboardingDraftStore.getState().draft?.pendingSaveDishId, undefined);
  } finally {
    service.setFavourite = original;
  }
});

test("retired sign-in profile application returns false so screens cannot complete stale onboarding", async () => {
  const { advanceAccountGeneration } = await import("@/lib/security/accountScope");
  const { getHungryService } = await import("@/lib/services/serviceProvider");
  useProfileStore.setState({ profile: structuredClone(userProfile) });
  useOnboardingDraftStore.getState().reset();
  useOnboardingDraftStore.getState().prepare(userProfile);
  useOnboardingDraftStore
    .getState()
    .update({ pendingSaveDishId: getDataRepository().listPopularNearby()[0].id });
  const service = getHungryService().profile;
  const original = service.setFavourite;
  let finish!: (saved: boolean) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  service.setFavourite = async () =>
    new Promise<boolean>((resolve) => {
      finish = resolve;
      markStarted();
    });
  try {
    const applying = applySignedInProfile(structuredClone(userProfile));
    await started;
    advanceAccountGeneration();
    advanceAccountGeneration();
    finish(true);
    assert.equal(await applying, false);
  } finally {
    service.setFavourite = original;
  }
});
