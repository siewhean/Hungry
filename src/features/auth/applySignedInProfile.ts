import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import type { TasteKey, TasteProfile, TasteVector, UserProfile } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";

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

export function applySignedInProfile(
  sessionProfile: UserProfile,
  options: { onSyncWarning?: () => void; profileReady?: Promise<UserProfile> } = {},
) {
  const profileState = useProfileStore.getState();
  const guestProfile = profileState.profile;
  const guestTasteProfile = guestProfile.tasteProfile ?? profileState.tasteProfile;
  const shouldMergeTaste = hasMeaningfulGuestTaste(guestProfile, guestTasteProfile);
  const shouldMergeDietary = hasMeaningfulGuestDietaryPreferences(guestProfile);
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
      void Promise.all([
        shouldMergeTaste
          ? getHungryService().profile.updateTasteProfile(guestTasteProfile)
          : Promise.resolve(),
        shouldMergeDietary
          ? getHungryService().profile.updateDietaryPreferences(guestProfile.dietaryPreferences)
          : Promise.resolve(),
      ])
        .catch(() => options.onSyncWarning?.())
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
