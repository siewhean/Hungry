import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
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
