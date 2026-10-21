import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { flushPendingQuizResponse } from "@/features/profile/pendingQuizResponse";
import { flushPendingDishSave } from "./pendingDishSave";
import { mergeDietaryPreferences, recalibrateTasteProfile } from "@/lib/ai/tasteEngine";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import {
  type ProvisionalOnboardingMigration,
  takeGuestSnapshotForSignIn,
  useProfileStore,
} from "@/store/useProfileStore";
import type { TasteKey, TasteProfile, TasteVector, UserProfile } from "@/types/domain";

const TASTE_KEYS: TasteKey[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

export type ProfileMigrationStatus = "synced" | "partial_retry_queued" | "failed";

export interface ProfileMigrationResult {
  status: ProfileMigrationStatus;
  profile: UserProfile;
  error?: unknown;
  /** Set when onboarding answers were blended into a saved profile (kept for retries). */
  resolvedTasteProfile?: TasteProfile;
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

function hasNoSavedTaste(profile: UserProfile) {
  return (
    vectorsMatch(profile.tasteVector, NEUTRAL_TASTE_VECTOR) &&
    (!profile.tasteProfile || tasteProfilesMatch(profile.tasteProfile, NEUTRAL_TASTE_PROFILE))
  );
}

function savedTasteProfile(profile: UserProfile): TasteProfile {
  return profile.tasteProfile ?? { ...NEUTRAL_TASTE_PROFILE, vector: profile.tasteVector };
}

/**
 * Onboarding answers meet the account's saved profile:
 * - taste: an account with no saved taste takes the answers as they are; a returning
 *   user's saved taste is recalibrated toward them (recalibrateTasteProfile);
 * - diet restrictions and allergies: union, so nothing stated is dropped.
 */
function resolveOnboardingTaste(
  serverProfile: UserProfile,
  provisional: ProvisionalOnboardingMigration,
): TasteProfile | undefined {
  if (provisional.resolvedTasteProfile) return provisional.resolvedTasteProfile;
  if (!provisional.tasteProfile) return undefined;
  if (hasNoSavedTaste(serverProfile)) return provisional.tasteProfile;
  return recalibrateTasteProfile(savedTasteProfile(serverProfile), provisional.tasteProfile);
}

function resolveOnboardingDietaryPreferences(
  serverProfile: UserProfile,
  provisional: ProvisionalOnboardingMigration,
): UserProfile["dietaryPreferences"] | undefined {
  if (provisional.dietaryPreferences.length === 0) return undefined;
  return mergeDietaryPreferences(serverProfile.dietaryPreferences, provisional.dietaryPreferences);
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
  const tasteProfile = resolveOnboardingTaste(serverProfile, provisional);
  const dietaryPreferences = resolveOnboardingDietaryPreferences(serverProfile, provisional);

  return {
    ...serverProfile,
    tasteVector: tasteProfile?.vector ?? serverProfile.tasteVector,
    tasteProfile: tasteProfile ?? serverProfile.tasteProfile,
    dietaryPreferences: dietaryPreferences ?? serverProfile.dietaryPreferences,
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

  // Resolve once against the saved profile; a retry reuses the same blended result.
  const resolvedTasteProfile = resolveOnboardingTaste(profileReady, provisional);
  const resolvedProvisional: ProvisionalOnboardingMigration = resolvedTasteProfile
    ? { ...provisional, resolvedTasteProfile }
    : provisional;
  const dietaryPreferences = resolveOnboardingDietaryPreferences(profileReady, provisional);

  const writes = await Promise.allSettled([
    resolvedTasteProfile ? operations.updateTasteProfile(resolvedTasteProfile) : Promise.resolve(),
    dietaryPreferences
      ? operations.updateDietaryPreferences(dietaryPreferences)
      : Promise.resolve(),
  ]);
  const rejected = writes.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const mergedProfile = mergeServerProfileWithProvisional(profileReady, resolvedProvisional);

  if (rejected) {
    return {
      status: "partial_retry_queued",
      profile: mergedProfile,
      error: rejected.reason,
      resolvedTasteProfile,
    };
  }

  return { status: "synced", profile: mergedProfile, resolvedTasteProfile };
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
  // The auth listener may already have replaced the onboarding (guest) profile;
  // use the copy it set aside for this account (main H1).
  const guestSnapshot = takeGuestSnapshotForSignIn(sessionProfile.id);
  const currentProfile = guestSnapshot?.profile ?? profileState.profile;
  // The quiz updates profile.tasteVector; take the vector from there so a stale
  // tasteProfile.vector never overwrites the onboarding answers (main #94).
  const currentTasteProfile = {
    ...(currentProfile.tasteProfile ?? guestSnapshot?.tasteProfile ?? profileState.tasteProfile),
    vector: currentProfile.tasteVector,
  };
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
    // After the account's profile is in place, so applying it cannot drop the save.
    void flushPendingDishSave().catch(() => undefined);
    return { status: "synced", profile };
  }

  const result = await runProvisionalOnboardingMigration(
    sessionProfile,
    provisional,
    profileMigrationOperations(options),
  );
  useProfileStore.getState().applyProfile(result.profile);
  // A dish saved on the onboarding result screen is added once the account profile is in place.
  void flushPendingDishSave().catch(() => undefined);

  if (result.status === "synced") {
    useProfileStore.getState().clearProvisionalOnboardingMigration(sessionProfile.id);
  } else {
    if (provisional && result.resolvedTasteProfile && !provisional.resolvedTasteProfile) {
      useProfileStore.getState().setProvisionalOnboardingMigration({
        ...provisional,
        resolvedTasteProfile: result.resolvedTasteProfile,
      });
    }
    options.onSyncWarning?.();
  }

  return result;
}
