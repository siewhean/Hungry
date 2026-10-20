import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { flushPendingQuizResponse } from "@/features/profile/pendingQuizResponse";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { type ProvisionalOnboardingMigration, useProfileStore } from "@/store/useProfileStore";
import type { TasteKey, TasteProfile, TasteVector, UserProfile } from "@/types/domain";

const TASTE_KEYS: TasteKey[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

export type ProfileMigrationStatus = "synced" | "partial_retry_queued" | "failed";

export interface ProfileMigrationResult {
  status: ProfileMigrationStatus;
  profile: UserProfile;
  error?: unknown;
}

type ProfileMigrationOperations = {
  awaitProfile: () => Promise<UserProfile>;
  updateTasteProfile: (profile: TasteProfile) => Promise<void>;
  updateDietaryPreferences: (preferences: UserProfile["dietaryPreferences"]) => Promise<void>;
};

function vectorsMatch(left: TasteVector, right: TasteVector) {
  return TASTE_KEYS.every((key) => left[key] === right[key]);
}

function tasteProfilesMatch(left: TasteProfile, right: TasteProfile) {
  return (
    vectorsMatch(left.vector, right.vector) &&
    left.bitterTolerance === right.bitterTolerance &&
    left.fatAffinity === right.fatAffinity &&
    left.textureArchetype === right.textureArchetype &&
    left.neophiliaIndex === right.neophiliaIndex &&
    left.spiceSeeking === right.spiceSeeking
  );
}

function hasMeaningfulProvisionalTaste(profile: UserProfile, tasteProfile: TasteProfile) {
  return (
    (profile.recommendationSignals?.signalCount ?? 0) > 0 ||
    !vectorsMatch(profile.tasteVector, NEUTRAL_TASTE_VECTOR) ||
    !tasteProfilesMatch(tasteProfile, NEUTRAL_TASTE_PROFILE)
  );
}

// Onboarding answers only fill an account that has none of its own: a returning
// user who signs in at the end of setup on a new phone keeps their saved profile.
function hasNoSavedTaste(profile: UserProfile) {
  return (
    vectorsMatch(profile.tasteVector, NEUTRAL_TASTE_VECTOR) &&
    (!profile.tasteProfile || tasteProfilesMatch(profile.tasteProfile, NEUTRAL_TASTE_PROFILE))
  );
}

function hasNoSavedDietaryPreferences(profile: UserProfile) {
  return profile.dietaryPreferences.length === 0;
}

function isProvisionalOnboardingProfile(profile: UserProfile) {
  return profile.id === "guest-user";
}

function copyLocationSnapshot() {
  const location = useLocationStore.getState();
  return {
    permission: location.permission,
    currentLocation: { ...location.currentLocation },
    manualLocation: location.manualLocation,
    manualCoordinate: location.manualCoordinate ? { ...location.manualCoordinate } : undefined,
    gpsBadgeState: location.gpsBadgeState,
  };
}

function createProvisionalMigration(
  userId: string,
  profile: UserProfile,
  tasteProfile: TasteProfile,
): ProvisionalOnboardingMigration | undefined {
  if (!isProvisionalOnboardingProfile(profile)) {
    return undefined;
  }

  return {
    userId,
    onboardingVersion: 1,
    capturedAt: new Date().toISOString(),
    tasteProfile: hasMeaningfulProvisionalTaste(profile, tasteProfile) ? tasteProfile : undefined,
    dietaryPreferences: [...profile.dietaryPreferences],
    location: copyLocationSnapshot(),
  };
}

/**
 * A server read is never allowed to replace an onboarding snapshot that is
 * still being migrated. This is also used for retry-after-restart, where the
 * original guest profile is no longer the active store profile.
 */
export function mergeServerProfileWithProvisional(
  serverProfile: UserProfile,
  provisional?: ProvisionalOnboardingMigration,
): UserProfile {
  if (!provisional || provisional.userId !== serverProfile.id) return serverProfile;
  const fillTaste = Boolean(provisional.tasteProfile) && hasNoSavedTaste(serverProfile);
  const fillDietary =
    provisional.dietaryPreferences.length > 0 && hasNoSavedDietaryPreferences(serverProfile);

  return {
    ...serverProfile,
    tasteVector:
      fillTaste && provisional.tasteProfile
        ? provisional.tasteProfile.vector
        : serverProfile.tasteVector,
    tasteProfile:
      fillTaste && provisional.tasteProfile ? provisional.tasteProfile : serverProfile.tasteProfile,
    dietaryPreferences: fillDietary
      ? provisional.dietaryPreferences
      : serverProfile.dietaryPreferences,
  };
}

export async function runProvisionalOnboardingMigration(
  sessionProfile: UserProfile,
  provisional: ProvisionalOnboardingMigration | undefined,
  operations: ProfileMigrationOperations,
): Promise<ProfileMigrationResult> {
  let profileReady: UserProfile;
  try {
    profileReady = await operations.awaitProfile();
  } catch (error) {
    return {
      status: "failed",
      profile: mergeServerProfileWithProvisional(sessionProfile, provisional),
      error,
    };
  }

  if (!provisional || provisional.userId !== sessionProfile.id) {
    return { status: "synced", profile: profileReady };
  }

  const writes = await Promise.allSettled([
    provisional.tasteProfile && hasNoSavedTaste(profileReady)
      ? operations.updateTasteProfile(provisional.tasteProfile)
      : Promise.resolve(),
    provisional.dietaryPreferences.length > 0 && hasNoSavedDietaryPreferences(profileReady)
      ? operations.updateDietaryPreferences(provisional.dietaryPreferences)
      : Promise.resolve(),
  ]);
  const rejected = writes.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const mergedProfile = mergeServerProfileWithProvisional(profileReady, provisional);

  if (rejected) {
    return { status: "partial_retry_queued", profile: mergedProfile, error: rejected.reason };
  }

  return { status: "synced", profile: mergedProfile };
}

function profileMigrationOperations(
  options: Pick<ApplySignedInProfileOptions, "profileReady">,
): ProfileMigrationOperations {
  return {
    awaitProfile: () => options.profileReady ?? getHungryService().profile.getProfile(),
    updateTasteProfile: (profile) => getHungryService().profile.updateTasteProfile(profile),
    updateDietaryPreferences: (preferences) =>
      getHungryService().profile.updateDietaryPreferences(preferences),
  };
}

export interface ApplySignedInProfileOptions {
  onSyncWarning?: () => void;
  profileReady?: Promise<UserProfile>;
}

/**
 * Applies a signed-in profile only after the local onboarding snapshot has
 * either been confirmed by Supabase or durably queued for idempotent retry.
 */
export async function applySignedInProfile(
  sessionProfile: UserProfile,
  options: ApplySignedInProfileOptions = {},
): Promise<ProfileMigrationResult> {
  const profileState = useProfileStore.getState();
  const provisionalFromStore = profileState.provisionalOnboardingMigration;
  const currentProfile = profileState.profile;
  const currentTasteProfile = currentProfile.tasteProfile ?? profileState.tasteProfile;
  const provisional =
    provisionalFromStore?.userId === sessionProfile.id
      ? provisionalFromStore
      : createProvisionalMigration(sessionProfile.id, currentProfile, currentTasteProfile);

  if (provisional && provisional !== provisionalFromStore) {
    profileState.setProvisionalOnboardingMigration(provisional);
  }

  // Quiz answers saved on the device before sign-in are recorded now (with quiz_version).
  void flushPendingQuizResponse().catch(() => undefined);

  if (getServiceProvider().mode === "mock") {
    const profile = mergeServerProfileWithProvisional(sessionProfile, provisional);
    useProfileStore.getState().applyProfile(profile);
    if (provisional)
      useProfileStore.getState().clearProvisionalOnboardingMigration(sessionProfile.id);
    return { status: "synced", profile };
  }

  const result = await runProvisionalOnboardingMigration(
    sessionProfile,
    provisional,
    profileMigrationOperations(options),
  );
  useProfileStore.getState().applyProfile(result.profile);

  if (result.status === "synced") {
    useProfileStore.getState().clearProvisionalOnboardingMigration(sessionProfile.id);
  } else {
    options.onSyncWarning?.();
  }

  return result;
}
