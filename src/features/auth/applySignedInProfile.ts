import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import type { TasteKey, TasteProfile, TasteVector, UserProfile } from "@/types/domain";
import { takeGuestSnapshotForSignIn, useProfileStore } from "@/store/useProfileStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { flushPendingQuizResponse } from "@/features/profile/pendingQuizResponse";

const TASTE_KEYS: TasteKey[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

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

function hasMeaningfulGuestTaste(profile: UserProfile, tasteProfile: TasteProfile) {
  if (profile.id !== "guest-user") {
    return false;
  }
  return (
    (profile.recommendationSignals?.signalCount ?? 0) > 0 ||
    !vectorsMatch(profile.tasteVector, NEUTRAL_TASTE_VECTOR) ||
    !tasteProfilesMatch(tasteProfile, NEUTRAL_TASTE_PROFILE)
  );
}

function hasMeaningfulGuestDietaryPreferences(profile: UserProfile) {
  return profile.id === "guest-user" && profile.dietaryPreferences.length > 0;
}

// Guest answers only fill an account that has none of its own: a returning user
// who browses briefly as a guest on a new phone keeps their saved profile.
function hasNoSavedTaste(profile: UserProfile) {
  return (
    vectorsMatch(profile.tasteVector, NEUTRAL_TASTE_VECTOR) &&
    (!profile.tasteProfile || tasteProfilesMatch(profile.tasteProfile, NEUTRAL_TASTE_PROFILE))
  );
}

function hasNoSavedDietaryPreferences(profile: UserProfile) {
  return profile.dietaryPreferences.length === 0;
}

export function applySignedInProfile(
  sessionProfile: UserProfile,
  options: { onSyncWarning?: () => void; profileReady?: Promise<UserProfile> } = {},
) {
  const profileState = useProfileStore.getState();
  // The auth listener may already have replaced the guest profile; use the
  // guest profile it set aside for this account.
  const guestSnapshot = takeGuestSnapshotForSignIn(sessionProfile.id);
  const guestProfile = guestSnapshot?.profile ?? profileState.profile;
  // The quiz updates profile.tasteVector; take the vector from there so a stale
  // tasteProfile.vector never overwrites the guest's answers on the server.
  const guestTasteProfile = {
    ...(guestProfile.tasteProfile ?? guestSnapshot?.tasteProfile ?? profileState.tasteProfile),
    vector: guestProfile.tasteVector,
  };
  const shouldMergeTaste =
    hasMeaningfulGuestTaste(guestProfile, guestTasteProfile) && hasNoSavedTaste(sessionProfile);
  const shouldMergeDietary =
    hasMeaningfulGuestDietaryPreferences(guestProfile) &&
    hasNoSavedDietaryPreferences(sessionProfile);
  const mergedProfile: UserProfile = {
    ...sessionProfile,
    tasteVector: shouldMergeTaste ? guestProfile.tasteVector : sessionProfile.tasteVector,
    tasteProfile: shouldMergeTaste ? guestTasteProfile : sessionProfile.tasteProfile,
    dietaryPreferences: shouldMergeDietary
      ? guestProfile.dietaryPreferences
      : sessionProfile.dietaryPreferences,
  };

  useProfileStore.getState().applyProfile(mergedProfile);

  if (getServiceProvider().mode === "mock") {
    return;
  }

  scheduleIdleWork(
    () => {
      void flushPendingQuizResponse();
      // An OAuth session starts from a provisional profile; check the guest merge
      // again against the account's real profile before writing anything.
      const serverProfileReady = options.profileReady
        ? options.profileReady.catch(() => sessionProfile)
        : Promise.resolve(sessionProfile);
      void serverProfileReady
        .then((serverProfile) => {
          const mergeTaste = shouldMergeTaste && hasNoSavedTaste(serverProfile);
          const mergeDietary = shouldMergeDietary && hasNoSavedDietaryPreferences(serverProfile);
          return Promise.all([
            mergeTaste
              ? getHungryService().profile.updateTasteProfile(guestTasteProfile)
              : Promise.resolve(),
            mergeDietary
              ? getHungryService().profile.updateDietaryPreferences(guestProfile.dietaryPreferences)
              : Promise.resolve(),
          ]).catch(() => options.onSyncWarning?.());
        })
        .then(() => options.profileReady ?? getHungryService().profile.getProfile())
        .then((profile) => {
          if (useProfileStore.getState().profile.id === sessionProfile.id) {
            useProfileStore.getState().applyProfile(profile);
          }
        })
        .catch(() => undefined);
    },
    { fallbackDelayMs: 0 },
  );
}
