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

test("onboarding answers recalibrate a returning account's saved taste and union its diet", () => {
  seedGuestWithQuizAnswers();
  applySignedInProfile(
    accountProfile({ tasteVector: SAVED_VECTOR, dietaryPreferences: ["vegetarian"] }),
  );
  const profile = useProfileStore.getState().profile;
  // 0.4 × saved + 0.6 × new on every axis.
  const expected = { sweet: 6.6, spicy: 7.4, sour: 3.8, salty: 5, rich: 6.8, aromatic: 5 };
  for (const [axis, value] of Object.entries(expected)) {
    const actual = profile.tasteVector[axis as keyof typeof expected];
    assert.ok(Math.abs(actual - value) < 1e-9, `${axis}: ${actual} !== ${value}`);
  }
  assert.deepEqual(profile.dietaryPreferences, ["vegetarian", "halal"]);
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

const SAVED_TASTE = {
  vector: { sweet: 9, spicy: 2, sour: 5, salty: 5, rich: 4, aromatic: 6 },
  bitterTolerance: 3,
  fatAffinity: 8,
  textureArchetype: "chewer" as const,
  neophiliaIndex: 2,
  spiceSeeking: 1,
};

test("a saved account profile is recalibrated, not overwritten, by the onboarding write", async () => {
  const written: unknown[] = [];
  const savedAccount: UserProfile = {
    ...serverProfile,
    tasteVector: SAVED_TASTE.vector,
    tasteProfile: SAVED_TASTE,
    dietaryPreferences: ["nut_free"],
  };
  const result = await runProvisionalOnboardingMigration(
    savedAccount,
    provisional,
    successfulOperations({
      awaitProfile: async () => savedAccount,
      updateTasteProfile: async (profile?: unknown) => {
        written.push(profile);
      },
      updateDietaryPreferences: async (preferences?: unknown) => {
        written.push(preferences);
      },
    }),
  );
  assert.equal(result.status, "synced");
  const taste = result.profile.tasteProfile;
  assert.ok(taste);
  // provisional spicy 7 vs saved 2: 2 + 0.6 × 5 = 5
  assert.ok(Math.abs(taste.vector.spicy - 5) < 1e-9);
  assert.equal(taste.textureArchetype, "chewer");
  assert.deepEqual(written[0], taste);
  // The saved nut allergy is kept alongside the new halal answer.
  assert.deepEqual(result.profile.dietaryPreferences, ["nut_free", "halal"]);
  assert.deepEqual(written[1], ["nut_free", "halal"]);
});

test("a retry after a partial failure writes the stored blend instead of blending twice", async () => {
  const savedAccount: UserProfile = {
    ...serverProfile,
    tasteVector: SAVED_TASTE.vector,
    tasteProfile: SAVED_TASTE,
  };
  const first = await runProvisionalOnboardingMigration(
    savedAccount,
    provisional,
    successfulOperations({
      awaitProfile: async () => savedAccount,
      updateDietaryPreferences: async () => {
        throw new Error("temporary write failure");
      },
    }),
  );
  assert.equal(first.status, "partial_retry_queued");
  assert.ok(first.resolvedTasteProfile);

  // The taste write landed, so the server now holds the blend; the retry must not re-blend it.
  const afterFirstWrite: UserProfile = {
    ...savedAccount,
    tasteVector: first.resolvedTasteProfile.vector,
    tasteProfile: first.resolvedTasteProfile,
  };
  const written: unknown[] = [];
  const retry = await runProvisionalOnboardingMigration(
    afterFirstWrite,
    { ...provisional, resolvedTasteProfile: first.resolvedTasteProfile },
    successfulOperations({
      awaitProfile: async () => afterFirstWrite,
      updateTasteProfile: async (profile?: unknown) => {
        written.push(profile);
      },
    }),
  );
  assert.equal(retry.status, "synced");
  assert.deepEqual(written[0], first.resolvedTasteProfile);
});
