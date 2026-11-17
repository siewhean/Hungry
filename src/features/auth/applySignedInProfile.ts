import { getAccountGeneration } from "@/lib/security/accountScope";
import { useOnboardingDraftStore } from "@/features/onboarding/useOnboardingDraftStore";
import { fulfillPendingOnboardingSave } from "@/features/onboarding/fulfillPendingSave";
import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import type { TasteKey, TasteProfile, TasteVector, UserProfile } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";

export interface GuestProfileSnapshot {
  profile: UserProfile;
  tasteProfile: TasteProfile;
}
let pendingGuestSnapshot: GuestProfileSnapshot | undefined;
export function captureGuestProfileSnapshot(): GuestProfileSnapshot | undefined {
  const state = useProfileStore.getState();
  if (state.profile.id === "guest-user") {
    pendingGuestSnapshot = {
      profile: JSON.parse(JSON.stringify(state.profile)) as UserProfile,
      tasteProfile: JSON.parse(
        JSON.stringify(state.profile.tasteProfile ?? state.tasteProfile),
      ) as TasteProfile,
    };
  }
  return pendingGuestSnapshot;
}
export function clearGuestProfileSnapshot() {
  pendingGuestSnapshot = undefined;
}

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

export async function applySignedInProfile(
  sessionProfile: UserProfile,
  options: {
    onSyncWarning?: () => void;
    profileReady?: Promise<UserProfile>;
    guestSnapshot?: GuestProfileSnapshot;
  } = {},
) {
  const generation = getAccountGeneration();
  const isCurrent = () =>
    generation === getAccountGeneration() &&
    useProfileStore.getState().profile.id === sessionProfile.id;
  const profileState = useProfileStore.getState();
  const snapshot = options.guestSnapshot ?? pendingGuestSnapshot;
  const guestProfile = snapshot?.profile ?? profileState.profile;
  const guestTasteProfile =
    snapshot?.tasteProfile ?? guestProfile.tasteProfile ?? profileState.tasteProfile;
  clearGuestProfileSnapshot();
  const shouldMergeTaste = hasMeaningfulGuestTaste(guestProfile, guestTasteProfile);
  const shouldMergeDietary = hasMeaningfulGuestDietaryPreferences(guestProfile);
  const mergedProfile: UserProfile = {
    ...sessionProfile,
    ...(guestProfile.id === "guest-user" && guestProfile.onboardingCuisineIds?.length
      ? { onboardingCuisineIds: guestProfile.onboardingCuisineIds }
      : {}),
    ...(guestProfile.id === "guest-user" && guestProfile.maxDishBudget !== undefined
      ? { maxDishBudget: guestProfile.maxDishBudget }
      : {}),
    ...(guestProfile.id === "guest-user" && guestProfile.onboardingSelectedDishIds?.length
      ? { onboardingSelectedDishIds: guestProfile.onboardingSelectedDishIds }
      : {}),
    tasteVector: shouldMergeTaste ? guestProfile.tasteVector : sessionProfile.tasteVector,
    tasteProfile: shouldMergeTaste ? guestTasteProfile : sessionProfile.tasteProfile,
    dietaryPreferences: shouldMergeDietary
      ? guestProfile.dietaryPreferences
      : sessionProfile.dietaryPreferences,
  };

  useProfileStore.getState().applyProfile(mergedProfile);
  await useOnboardingDraftStore.getState().setAccountScope(sessionProfile.id, { adoptGuest: true });
  if (!isCurrent()) return false;
  await fulfillPendingOnboardingSave().catch(() => {
    if (isCurrent()) options.onSyncWarning?.();
  });
  if (!isCurrent()) return false;

  if (getServiceProvider().mode === "mock") {
    return true;
  }

  scheduleIdleWork(
    () => {
      if (!isCurrent()) return;
      void Promise.all([
        guestProfile.id === "guest-user"
          ? getHungryService().profile.updateProfile({
              onboardingCuisineIds: mergedProfile.onboardingCuisineIds,
              maxDishBudget: mergedProfile.maxDishBudget,
              onboardingSelectedDishIds: mergedProfile.onboardingSelectedDishIds,
            })
          : Promise.resolve(),
        shouldMergeTaste
          ? getHungryService().profile.updateTasteProfile(guestTasteProfile)
          : Promise.resolve(),
        shouldMergeDietary
          ? getHungryService().profile.updateDietaryPreferences(guestProfile.dietaryPreferences)
          : Promise.resolve(),
      ])
        .catch(() => {
          if (isCurrent()) options.onSyncWarning?.();
        })
        .then(async () => {
          await options.profileReady;
          if (!isCurrent()) return null;
          return getHungryService().profile.getProfile();
        })
        .then((profile) => {
          if (profile && isCurrent()) {
            useProfileStore.getState().applyProfile(profile);
          }
        })
        .catch(() => undefined);
    },
    { fallbackDelayMs: 0 },
  );
  return true;
}
