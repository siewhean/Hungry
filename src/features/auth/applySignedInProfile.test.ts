import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  applySignedInProfile,
  mergeServerProfileWithProvisional,
  runProvisionalOnboardingMigration,
} from "./applySignedInProfile";
import { type ProvisionalOnboardingMigration, useProfileStore } from "@/store/useProfileStore";
import type { UserProfile } from "@/types/domain";

const serverProfile: UserProfile = {
  id: "4b3a9000-0000-4000-8000-000000000001",
  displayName: "Existing user",
  email: "person@example.com",
  profileVisibility: "public",
  tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
  dietaryPreferences: [],
  favouriteDishIds: [],
  reviewedDishIds: [],
  stats: {
    dishesReviewed: 0,
    stallsVisited: 0,
    favouritesCount: 0,
    followersCount: 0,
    followingCount: 0,
  },
};

const provisional: ProvisionalOnboardingMigration = {
  userId: serverProfile.id,
  onboardingVersion: 1,
  capturedAt: "2026-07-24T00:00:00.000Z",
  tasteProfile: {
    vector: { sweet: 8, spicy: 7, sour: 3, salty: 6, rich: 8, aromatic: 9 },
    bitterTolerance: 4,
    fatAffinity: 8,
    textureArchetype: "chewer",
    neophiliaIndex: 7,
    spiceSeeking: 8,
  },
  dietaryPreferences: ["halal"],
  location: {
    permission: "denied",
    currentLocation: { latitude: 1.3331, longitude: 103.7437 },
    manualLocation: "Jurong East",
    manualCoordinate: { latitude: 1.3331, longitude: 103.7437 },
    gpsBadgeState: "manual",
  },
};

function successfulOperations(
  overrides: Partial<{
    awaitProfile: () => Promise<UserProfile>;
    updateTasteProfile: () => Promise<void>;
    updateDietaryPreferences: () => Promise<void>;
  }> = {},
) {
  return {
    awaitProfile: overrides.awaitProfile ?? (async () => serverProfile),
    updateTasteProfile: overrides.updateTasteProfile ?? (async () => undefined),
    updateDietaryPreferences: overrides.updateDietaryPreferences ?? (async () => undefined),
  };
}

test("signup and verification migrations await profile provisioning before reporting synced", async () => {
  const events: string[] = [];
  const result = await runProvisionalOnboardingMigration(
    serverProfile,
    provisional,
    successfulOperations({
      awaitProfile: async () => {
        events.push("profile-ready");
        return serverProfile;
      },
      updateTasteProfile: async () => {
        events.push("taste");
      },
      updateDietaryPreferences: async () => {
        events.push("dietary");
      },
    }),
  );

  assert.equal(result.status, "synced");
  assert.deepEqual(events, ["profile-ready", "taste", "dietary"]);
});

test("existing login with no provisional onboarding profile remains synced", async () => {
  const result = await runProvisionalOnboardingMigration(
    serverProfile,
    undefined,
    successfulOperations(),
  );

  assert.equal(result.status, "synced");
  assert.equal(result.profile, serverProfile);
});

test("cold restore resolves server/local preference conflicts in favour of the provisional profile", () => {
  const merged = mergeServerProfileWithProvisional(serverProfile, provisional);

  assert.deepEqual(merged.tasteProfile, provisional.tasteProfile);
  assert.deepEqual(merged.dietaryPreferences, ["halal"]);
});

test("migration provisioning failure blocks full success", async () => {
  const result = await runProvisionalOnboardingMigration(
    serverProfile,
    provisional,
    successfulOperations({
      awaitProfile: async () => Promise.reject(new Error("profile unavailable")),
    }),
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(result.profile.dietaryPreferences, ["halal"]);
});

test("failed writes remain queued and retry idempotently after restart", async () => {
  let attempted = 0;
  const first = await runProvisionalOnboardingMigration(
    serverProfile,
    provisional,
    successfulOperations({
      updateTasteProfile: async () => {
        attempted += 1;
        throw new Error("temporary write failure");
      },
    }),
  );
  const retry = await runProvisionalOnboardingMigration(
    serverProfile,
    provisional,
    successfulOperations({
      updateTasteProfile: async () => {
        attempted += 1;
      },
    }),
  );

  assert.equal(first.status, "partial_retry_queued");
  assert.equal(retry.status, "synced");
  assert.equal(attempted, 2);
});

const GUEST_VECTOR = { ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 8 };
const SAVED_VECTOR = { ...NEUTRAL_TASTE_VECTOR, sweet: 9, sour: 2 };

function seedGuestWithQuizAnswers() {
  const current = useProfileStore.getState().profile;
  // The quiz writes the vector and the full taste profile together.
  const guestTasteProfile = { ...NEUTRAL_TASTE_PROFILE, vector: GUEST_VECTOR };
  useProfileStore.setState({
    profile: {
      ...current,
      id: "guest-user",
      tasteVector: GUEST_VECTOR,
      tasteProfile: guestTasteProfile,
      dietaryPreferences: ["halal"],
    },
    tasteProfile: guestTasteProfile,
    provisionalOnboardingMigration: undefined,
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
