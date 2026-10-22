import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { useProfileStore } from "@/store/useProfileStore";
import type { UserProfile } from "@/types/domain";
import { applySignedInProfile } from "./applySignedInProfile";

const GUEST_VECTOR = { ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 8 };
const SAVED_VECTOR = { ...NEUTRAL_TASTE_VECTOR, sweet: 9, sour: 2 };

function seedGuestWithQuizAnswers() {
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...current,
      id: "guest-user",
      tasteVector: GUEST_VECTOR,
      tasteProfile: undefined,
      dietaryPreferences: ["halal"],
    },
  });
}

function accountProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    ...useProfileStore.getState().profile,
    id: "11111111-1111-4111-8111-111111111111",
    tasteProfile: undefined,
    ...overrides,
  };
}

test("guest answers never overwrite a returning account's saved taste and diet", () => {
  seedGuestWithQuizAnswers();
  applySignedInProfile(
    accountProfile({ tasteVector: SAVED_VECTOR, dietaryPreferences: ["vegetarian"] }),
  );
  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.tasteVector, SAVED_VECTOR);
  assert.deepEqual(profile.dietaryPreferences, ["vegetarian"]);
});

test("guest answers fill an account that has no saved taste or diet yet", () => {
  seedGuestWithQuizAnswers();
  applySignedInProfile(
    accountProfile({ tasteVector: { ...NEUTRAL_TASTE_VECTOR }, dietaryPreferences: [] }),
  );
  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.tasteVector, GUEST_VECTOR);
  assert.deepEqual(profile.dietaryPreferences, ["halal"]);
});

test("guest merge keeps the quiz vector when the guest tasteProfile vector is stale", () => {
  seedGuestWithQuizAnswers();
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...current,
      tasteProfile: { ...NEUTRAL_TASTE_PROFILE, foodOpenness: "adventurous" },
    },
  });
  applySignedInProfile(
    accountProfile({ tasteVector: { ...NEUTRAL_TASTE_VECTOR }, dietaryPreferences: [] }),
  );
  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.tasteVector, GUEST_VECTOR);
  assert.deepEqual(profile.tasteProfile?.vector, GUEST_VECTOR);
  assert.equal(profile.tasteProfile?.foodOpenness, "adventurous");
});

test("guest answers survive when the auth listener syncs the account profile first", () => {
  seedGuestWithQuizAnswers();
  const account = accountProfile({
    tasteVector: { ...NEUTRAL_TASTE_VECTOR },
    dietaryPreferences: [],
  });
  // supabase-js fires SIGNED_IN (and so syncProfile) before signIn returns to the screen.
  useProfileStore.getState().syncProfile(true, account.id);
  assert.notEqual(useProfileStore.getState().profile.id, "guest-user");
  applySignedInProfile(account);
  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.tasteVector, GUEST_VECTOR);
  assert.deepEqual(profile.dietaryPreferences, ["halal"]);
});

// r2 onboarding-M4: the budget answer is merged like the dietary flags.
test("a guest's budget answer fills an account with no budget, and never overwrites a saved one", () => {
  seedGuestWithQuizAnswers();
  useProfileStore.setState({
    profile: { ...useProfileStore.getState().profile, maxDishBudget: 6 },
  });
  applySignedInProfile(accountProfile({ maxDishBudget: undefined }));
  assert.equal(useProfileStore.getState().profile.maxDishBudget, 6);

  seedGuestWithQuizAnswers();
  useProfileStore.setState({
    profile: { ...useProfileStore.getState().profile, maxDishBudget: 6 },
  });
  applySignedInProfile(accountProfile({ maxDishBudget: 12 }));
  assert.equal(useProfileStore.getState().profile.maxDishBudget, 12);
});
