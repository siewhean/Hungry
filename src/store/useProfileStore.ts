import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  averageTasteVectors,
  processExplicitFeedback,
  type ExplicitFeedbackEvent,
} from "@/lib/ai/tasteEngine";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
  getSimilarityScore,
} from "@/lib/services/serviceProvider";
import type { ExplicitFeedbackInput } from "@/lib/services/types";
import {
  applyAffinityEvent,
  deriveLocalFoodHistory,
  mergeFoodHistory,
  type AffinitySignal,
} from "@/lib/ai/foodHistory";
import { OPENNESS_NEOPHILIA_INDEX } from "@/lib/ai/exploration";
import type {
  DietaryFlag,
  DishDetail,
  FoodOpenness,
  RecommendationSurface,
  ProfileVisibility,
  TasteProfile,
  TasteInteractionEvent,
  TasteInteractionType,
  TasteVector,
  UserDishAffinity,
  UserProfile,
} from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { hungryPersistStorage } from "./persistStorage";
import { useUIStore } from "./useUIStore";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";

const SUPABASE_USER_GUEST_PROFILE: UserProfile = {
  id: "guest-user",
  displayName: "Guest",
  email: "guest@hungry.local",
  profileVisibility: "public",
  tasteVector: NEUTRAL_TASTE_VECTOR,
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

function isUuidLikeProfileId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function ensureSupabaseCompatibleProfile(profile: UserProfile): UserProfile {
  if (getConfiguredDataSource() !== "supabase") {
    return profile;
  }
  if (isUuidLikeProfileId(profile.id)) {
    return profile;
  }
  if (profile.id === "guest-user") {
    return { ...SUPABASE_USER_GUEST_PROFILE };
  }
  return { ...SUPABASE_USER_GUEST_PROFILE };
}

function getSessionStoreState() {
  const { useSessionStore } = require("./useSessionStore") as typeof import("./useSessionStore");
  return useSessionStore.getState();
}

function shouldSyncAuthenticatedProfile(profile: UserProfile): boolean {
  if (getServiceProvider().mode === "mock") {
    return false;
  }
  const session = getSessionStoreState();
  return (
    session.isAuthenticated &&
    Boolean(session.authenticatedUserId) &&
    profile.id === session.authenticatedUserId
  );
}

function withNeutralTasteProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    tasteProfile: profile.tasteProfile ?? {
      ...NEUTRAL_TASTE_PROFILE,
      vector: profile.tasteVector,
    },
  };
}

interface ProfileState {
  profile: UserProfile;
  /** Extended taste profile with psychometric secondary axes */
  tasteProfile: TasteProfile;
  tasteInteractionEvents: TasteInteractionEvent[];
  reviewEntries: Record<
    string,
    { rating: number; text: string; tags: string[]; createdAt: string }
  >;
  /** True when the last attempt to load favourites from the backend failed. Not persisted. */
  favouritesRehydrationFailed: boolean;
  /** Per-dish food history: server rows plus this device's not-yet-synced signals. */
  foodHistory: UserDishAffinity[];
  loadFoodHistory: () => Promise<void>;
  resetFoodHistory: () => Promise<void>;
  /** Onboarding / Settings: how open the user is to new food. Also sets neophiliaIndex. */
  setFoodOpenness: (openness: FoodOpenness, surface: "onboarding" | "settings") => void;
  applyProfile: (profile: UserProfile) => void;
  syncProfile: (isAuthenticated: boolean, userId?: string | null) => void;
  toggleFavourite: (dish: DishDetail) => void;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email" | "avatarUrl">>) => void;
  /** Resolves false when the server rejected the change and the old value was restored. */
  setProfileVisibility: (profileVisibility: ProfileVisibility) => Promise<boolean>;
  setTasteVector: (tasteVector: TasteVector) => void;
  setTasteProfile: (tasteProfile: TasteProfile) => void;
  setDietaryPreferences: (dietaryPreferences: DietaryFlag[]) => void;
  /** Saved on the account (user_profiles.max_dish_budget) when signed in; kept on the device for guests. */
  setMaxDishBudget: (maxDishBudget: number | undefined) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
  removeReviewedDish: (dishId: string) => void;
  /**
   * The dish "Tried" button: updates the Tried list at once, saves it on the server and
   * restores the old list when the save fails. Resolves false on failure.
   */
  setDishTried: (dishId: string, tried: boolean) => Promise<boolean>;
  recordReviewEntry: (
    dishId: string,
    entry: { rating: number; text: string; tags: string[] },
  ) => void;
  recordTasteInteraction: (input: RecordTasteInteractionInput) => TasteInteractionEvent | undefined;
  clearProfile: () => void;
}

interface RecordTasteInteractionInput {
  type: TasteInteractionType;
  surface: RecommendationSurface;
  dish?: DishDetail;
  dishId?: string;
  query?: string;
  chipId?: string;
  buttonId?: string;
  rating?: number;
}

const FEEDBACK_CONFIDENCE_DELTAS: Record<ExplicitFeedbackEvent["type"], number> = {
  saved: 0.04,
  unsaved: 0.005,
  rating_5_star: 0.03,
  rating_4_star: 0.02,
  rating_3_star: 0.01,
  rating_2_star: 0.015,
  rating_1_star: 0.02,
  hawker_tag_positive: 0.01,
  hawker_tag_negative: 0.01,
  search_query: 0.003,
  dish_result_click: 0.012,
  dish_like: 0.018,
  food_button_click: 0.012,
  dismissed: 0.01,
};

const pendingFavouriteDishToggles = new Set<string>();
const activatedProfileIds = new Set<string>();

// supabase-js fires SIGNED_IN before signIn/verifyOtp return, so syncProfile swaps
// the guest profile for the account's blank one before the screen can merge it.
// Keep the guest's profile here so applySignedInProfile still sees the guest's
// diet and taste.
type GuestSnapshot = { userId: string; profile: UserProfile; tasteProfile: TasteProfile };
let guestSnapshotBeforeSignIn: GuestSnapshot | null = null;

export function takeGuestSnapshotForSignIn(userId: string) {
  const snapshot = guestSnapshotBeforeSignIn;
  guestSnapshotBeforeSignIn = null;
  return snapshot && snapshot.userId === userId ? snapshot : null;
}

// "activated": a person's first Tried or first save. `previous` is the profile
// before the action, so it fires only when nothing was saved or tried yet.
function trackActivationOnce(previous: UserProfile, trigger: "tried" | "saved", dishId: string) {
  if (previous.favouriteDishIds.length > 0 || previous.reviewedDishIds.length > 0) return;
  if (activatedProfileIds.has(previous.id)) return;
  activatedProfileIds.add(previous.id);
  trackAnalyticsEvent("activated", { trigger, dish_id: dishId }, { userId: previous.id });
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function getRatingFeedbackType(rating: number): ExplicitFeedbackEvent["type"] {
  if (rating >= 5) return "rating_5_star";
  if (rating >= 4) return "rating_4_star";
  if (rating >= 3) return "rating_3_star";
  if (rating >= 2) return "rating_2_star";
  return "rating_1_star";
}

function bumpRecommendationSignals(
  profile: UserProfile,
  feedbackType: ExplicitFeedbackEvent["type"],
) {
  const previous =
    profile.recommendationSignals ??
    ({
      confidence: 0,
      signalCount: 0,
    } as const);
  return {
    confidence: clampConfidence(previous.confidence + FEEDBACK_CONFIDENCE_DELTAS[feedbackType]),
    signalCount: previous.signalCount + 1,
    lastSignalAt: new Date().toISOString(),
  };
}

const MAX_TASTE_INTERACTION_EVENTS = 100;
const LOW_VALUE_SIGNAL_WINDOW_MS = 10 * 60 * 1000;
const LOW_VALUE_SIGNAL_CAP = 3;
const CAPPED_INTERACTION_TYPES = new Set<TasteInteractionType>([
  "search_query",
  "dish_result_click",
  "food_button_click",
]);

function appendTasteEvent(events: TasteInteractionEvent[], event: TasteInteractionEvent) {
  return [event, ...events].slice(0, MAX_TASTE_INTERACTION_EVENTS);
}

function createTasteEvent(
  input: RecordTasteInteractionInput,
  before: TasteVector,
  after: TasteVector,
  applied: boolean,
  reason?: TasteInteractionEvent["reason"],
): TasteInteractionEvent {
  return {
    id: `taste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    surface: input.surface,
    dishId: input.dish?.id ?? input.dishId,
    query: input.query,
    chipId: input.chipId,
    buttonId: input.buttonId,
    rating: input.rating,
    createdAt: new Date().toISOString(),
    userVectorBefore: before,
    userVectorAfter: after,
    applied,
    reason,
  };
}

function getInteractionKey(input: RecordTasteInteractionInput) {
  const target =
    input.dish?.id ?? input.dishId ?? input.query ?? input.chipId ?? input.buttonId ?? "";
  return `${input.type}:${input.surface}:${target}`;
}

function isCappedInteraction(
  events: TasteInteractionEvent[],
  input: RecordTasteInteractionInput,
  now = Date.now(),
) {
  if (!CAPPED_INTERACTION_TYPES.has(input.type)) return false;
  const key = getInteractionKey(input);
  const recentCount = events.filter((event) => {
    if (getInteractionKey(event) !== key) return false;
    const timestamp = new Date(event.createdAt).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= LOW_VALUE_SIGNAL_WINDOW_MS;
  }).length;
  return recentCount >= LOW_VALUE_SIGNAL_CAP;
}

function getInteractionFeedbackType(
  input: RecordTasteInteractionInput,
): ExplicitFeedbackEvent["type"] | undefined {
  if (input.type === "saved") return "saved";
  if (input.type === "unsaved") return "unsaved";
  if (input.type === "search_query") return "search_query";
  if (input.type === "dish_result_click") return "dish_result_click";
  if (input.type === "dish_like") return "dish_like";
  if (input.type === "food_button_click") return "food_button_click";
  if (input.type === "dismissed") return "dismissed";
  if (input.type === "hawker_tag") return "hawker_tag_positive";
  if (input.type === "rating" || input.type === "review") {
    return getRatingFeedbackType(input.rating ?? 3);
  }
  return undefined;
}

function getServiceFeedbackType(
  input: RecordTasteInteractionInput,
): ExplicitFeedbackInput["feedbackType"] | undefined {
  if (input.type === "saved") return "save";
  if (input.type === "unsaved") return "unsave";
  if (input.type === "rating") return "rating";
  if (input.type === "review") return "review";
  if (input.type === "search_query") return "search_query";
  if (input.type === "dish_result_click") return "dish_result_click";
  if (input.type === "dish_like") return "dish_like";
  if (input.type === "food_button_click") return "food_button_click";
  if (input.type === "dismissed") return "dismissed";
  if (input.type === "hawker_tag") return "hawker_tag";
  return undefined;
}

function persistTasteInteraction(
  input: RecordTasteInteractionInput,
  event?: TasteInteractionEvent,
) {
  // Silent taste signals are never sent for a guest; they stay on the device.
  if (
    !event ||
    getServiceProvider().mode !== "supabase" ||
    !getSessionStoreState().isAuthenticated
  ) {
    return;
  }

  const feedbackType = getServiceFeedbackType(input);
  if (!feedbackType) {
    return;
  }

  void getHungryService()
    .recommendations.recordExplicitFeedback({
      feedbackType,
      surface: input.surface,
      dishId: input.dish?.id ?? input.dishId,
      query: input.query,
      chipId: input.chipId,
      buttonId: input.buttonId,
      rating: input.rating,
      createdAt: event.createdAt,
      applied: event.applied,
      reason: event.reason,
      userVectorBefore: event.userVectorBefore,
      userVectorAfter: event.userVectorAfter,
    })
    .catch(() => {});
}

function getSearchInteractionVector(profile: UserProfile, query?: string) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) return undefined;
  const repository = getDataRepository();
  const matchingDishes = repository
    .searchDishes(
      {
        query: normalizedQuery,
        categories: [],
        dietaryFlags: profile.dietaryPreferences,
        tasteValues: profile.tasteVector,
        radius: Number.MAX_SAFE_INTEGER,
      },
      profile.tasteVector,
    )
    .slice(0, 5);

  if (matchingDishes.length === 0) return undefined;
  return averageTasteVectors(
    matchingDishes.map((dish) => dish.tasteVector),
    profile.tasteVector,
  );
}

function resolveInteractionVector(input: RecordTasteInteractionInput, profile: UserProfile) {
  if (input.dish) return input.dish.tasteVector;
  if (input.dishId) {
    return getDataRepository().getDishById(input.dishId)?.tasteVector;
  }
  if (input.type === "search_query") {
    return getSearchInteractionVector(profile, input.query);
  }
  return undefined;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: withNeutralTasteProfile(
        ensureSupabaseCompatibleProfile(getDataRepository().getProfile(false)),
      ),
      tasteProfile: NEUTRAL_TASTE_PROFILE,
      tasteInteractionEvents: [],
      reviewEntries: {},
      favouritesRehydrationFailed: false,
      foodHistory: [],
      loadFoodHistory: async () => {
        const userId = get().profile.id;
        try {
          const rows = await getHungryService().recommendations.getFoodHistory();
          if (get().profile.id !== userId) return;
          // Server rows replace local ones; dismissals made on this device stay until the server has them.
          set((state) => ({
            foodHistory: mergeFoodHistory(
              rows,
              state.foodHistory.filter((row) => row.dismissedUntil),
            ),
          }));
        } catch (error) {
          console.warn("Failed to load food history", error);
        }
      },
      resetFoodHistory: async () => {
        await getHungryService().recommendations.resetFoodHistory();
        set({ foodHistory: [] });
        trackAnalyticsEvent("food_history_reset", {});
      },
      setFoodOpenness: (openness, surface) => {
        const previousSnapshot = { profile: get().profile, tasteProfile: get().tasteProfile };
        const base = get().profile.tasteProfile ?? get().tasteProfile;
        const tasteProfile: TasteProfile = {
          ...base,
          // profile.tasteVector is the source of truth; base.vector can lag behind the quiz.
          vector: get().profile.tasteVector,
          foodOpenness: openness,
          neophiliaIndex: OPENNESS_NEOPHILIA_INDEX[openness],
        };
        set((state) => ({ profile: { ...state.profile, tasteProfile }, tasteProfile }));
        trackAnalyticsEvent("food_openness_set", { openness, surface });
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) return;
        void getHungryService()
          .profile.updateTasteProfile(tasteProfile)
          .catch((error) => {
            console.error("Failed to sync food openness", error);
            if (get().profile !== optimisticProfile) return;
            set(previousSnapshot);
          });
      },
      applyProfile: (profile) =>
        set({
          profile: withNeutralTasteProfile(ensureSupabaseCompatibleProfile(profile)),
          tasteProfile: profile.tasteProfile ?? {
            ...NEUTRAL_TASTE_PROFILE,
            vector: profile.tasteVector,
          },
        }),
      syncProfile: (isAuthenticated, userId) => {
        const currentProfile = get().profile;
        const authenticatedUserId =
          isAuthenticated && userId && getServiceProvider().mode !== "mock" ? userId : null;
        const rehydrateFavouriteDishIds = () => {
          if (!authenticatedUserId) return;
          const targetUserId = authenticatedUserId;
          void getHungryService()
            .profile.getFavouriteDishIds()
            .then((ids) => {
              const session = getSessionStoreState();
              if (!session.isAuthenticated || session.authenticatedUserId !== targetUserId) {
                return;
              }
              set((state) => {
                if (state.profile.id !== targetUserId) return {};
                return {
                  favouritesRehydrationFailed: false,
                  profile: withNeutralTasteProfile({
                    ...state.profile,
                    favouriteDishIds: ids,
                    stats: {
                      ...state.profile.stats,
                      favouritesCount: ids.length,
                    },
                  }),
                };
              });
            })
            .catch((error) => {
              console.warn("Failed to rehydrate favourite dish IDs", error);
              set({ favouritesRehydrationFailed: true });
            });
        };

        if (isAuthenticated && userId && currentProfile.id === userId) {
          rehydrateFavouriteDishIds();
          if (authenticatedUserId) void get().loadFoodHistory();
          return;
        }

        guestSnapshotBeforeSignIn =
          isAuthenticated && userId && currentProfile.id === "guest-user"
            ? { userId, profile: currentProfile, tasteProfile: get().tasteProfile }
            : null;
        set({
          profile: withNeutralTasteProfile(
            ensureSupabaseCompatibleProfile(
              getDataRepository().getProfile(isAuthenticated, userId),
            ),
          ),
          tasteProfile: NEUTRAL_TASTE_PROFILE,
          foodHistory: [],
        });
        rehydrateFavouriteDishIds();
        if (authenticatedUserId) void get().loadFoodHistory();
      },
      toggleFavourite: (dish) => {
        const dishId = dish.id;
        if (pendingFavouriteDishToggles.has(dishId)) {
          return;
        }
        if (!getSessionStoreState().isAuthenticated) {
          console.warn("Favourite toggle ignored because the user is signed out.");
          return;
        }
        pendingFavouriteDishToggles.add(dishId);
        const previousSnapshot = {
          profile: get().profile,
          tasteProfile: get().tasteProfile,
          tasteInteractionEvents: get().tasteInteractionEvents,
        };
        let recordedEvent: TasteInteractionEvent | undefined;
        let interactionInput: RecordTasteInteractionInput | undefined;
        set((state) => {
          const isFavourite = state.profile.favouriteDishIds.includes(dishId);
          const nextIds = isFavourite
            ? state.profile.favouriteDishIds.filter((id) => id !== dishId)
            : [...state.profile.favouriteDishIds, dishId];
          const feedbackType: ExplicitFeedbackEvent["type"] = isFavourite ? "unsaved" : "saved";
          const updatedTasteVector = processExplicitFeedback(state.profile.tasteVector, {
            type: feedbackType,
            dishVector: dish.tasteVector,
            dishConfidence: dish.tasteConfidence,
            timestamp: Date.now(),
          });
          interactionInput = { type: isFavourite ? "unsaved" : "saved", surface: "profile", dish };
          const event = createTasteEvent(
            interactionInput,
            state.profile.tasteVector,
            updatedTasteVector,
            true,
          );
          recordedEvent = event;

          trackAnalyticsEvent(isFavourite ? "dish_unfavourited" : "dish_favourited", {
            dish_id: dish.id,
            venue_id: dish.venueId,
          });
          if (!isFavourite) {
            trackActivationOnce(state.profile, "saved", dish.id);
          }

          const nextProfile = {
            ...state.profile,
            favouriteDishIds: nextIds,
            stats: {
              ...state.profile.stats,
              favouritesCount: nextIds.length,
            },
            tasteVector: updatedTasteVector,
            recommendationSignals: bumpRecommendationSignals(state.profile, feedbackType),
          };

          return {
            profile: nextProfile,
            tasteProfile: {
              ...state.tasteProfile,
              vector: updatedTasteVector,
            },
            tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
          };
        });
        if (interactionInput) {
          persistTasteInteraction(interactionInput, recordedEvent);
        }
        if (getServiceProvider().mode !== "mock") {
          const optimisticProfile = get().profile;
          void getHungryService()
            .profile.toggleFavourite(dishId)
            .catch((error) => {
              console.error("Failed to sync favourite toggle", error);
              if (get().profile !== optimisticProfile) return;
              set(previousSnapshot);
              useUIStore.getState().showToast({
                message: "Couldn't update your favourites. Please try again.",
                tone: "error",
              });
            })
            .finally(() => {
              pendingFavouriteDishToggles.delete(dishId);
            });
        } else {
          pendingFavouriteDishToggles.delete(dishId);
        }
      },
      updateProfile: (next) => {
        const previousProfile = get().profile;
        set((state) => ({
          profile: {
            ...state.profile,
            ...next,
          },
        }));
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateProfile(next)
          .catch((error) => {
            console.error("Failed to sync profile update", error);
            if (get().profile !== optimisticProfile) return;
            set({ profile: previousProfile });
          });
      },
      setProfileVisibility: async (profileVisibility) => {
        const currentVisibility = get().profile.profileVisibility;
        if (currentVisibility === profileVisibility) return true;
        const previousProfile = get().profile;
        set((state) => ({
          profile: {
            ...state.profile,
            profileVisibility,
          },
        }));
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return true;
        }
        try {
          await getHungryService().profile.updateProfile({ profileVisibility });
          return true;
        } catch (error) {
          console.error("Failed to update profile visibility", error);
          if (get().profile === optimisticProfile) set({ profile: previousProfile });
          return false;
        }
      },
      setTasteVector: (tasteVector) => {
        const previousSnapshot = {
          profile: get().profile,
          tasteProfile: get().tasteProfile,
          tasteInteractionEvents: get().tasteInteractionEvents,
        };
        set((state) => {
          trackAnalyticsEvent("taste_quiz_completed", {
            skipped: false,
            vector: tasteVector,
          });
          const event = createTasteEvent(
            { type: "quiz_completed", surface: "profile" },
            state.profile.tasteVector,
            tasteVector,
            true,
          );
          return {
            profile: {
              ...state.profile,
              tasteVector,
              tasteProfile: state.profile.tasteProfile
                ? { ...state.profile.tasteProfile, vector: tasteVector }
                : undefined,
              recommendationSignals: {
                confidence: clampConfidence(
                  (state.profile.recommendationSignals?.confidence ?? 0) + 0.05,
                ),
                signalCount: (state.profile.recommendationSignals?.signalCount ?? 0) + 1,
                lastSignalAt: event.createdAt,
              },
            },
            tasteProfile: {
              ...state.tasteProfile,
              vector: tasteVector,
            },
            tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
          };
        });
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateTasteVector(tasteVector)
          .catch((error) => {
            console.error("Failed to sync taste vector", error);
            if (get().profile !== optimisticProfile) return;
            set(previousSnapshot);
          });
      },
      setTasteProfile: (tasteProfile) => {
        const previousSnapshot = {
          profile: get().profile,
          tasteProfile: get().tasteProfile,
          tasteInteractionEvents: get().tasteInteractionEvents,
        };
        set((state) => {
          trackAnalyticsEvent("taste_quiz_completed", {
            skipped: false,
            vector: tasteProfile.vector,
            neophiliaIndex: tasteProfile.neophiliaIndex,
            textureArchetype: tasteProfile.textureArchetype,
          });
          const event = createTasteEvent(
            { type: "quiz_completed", surface: "profile" },
            state.profile.tasteVector,
            tasteProfile.vector,
            true,
          );
          return {
            profile: {
              ...state.profile,
              tasteVector: tasteProfile.vector,
              tasteProfile,
              recommendationSignals: {
                confidence: clampConfidence(
                  (state.profile.recommendationSignals?.confidence ?? 0) + 0.05,
                ),
                signalCount: (state.profile.recommendationSignals?.signalCount ?? 0) + 1,
                lastSignalAt: event.createdAt,
              },
            },
            tasteProfile,
            tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
          };
        });
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateTasteProfile(tasteProfile)
          .catch((error) => {
            console.error("Failed to sync taste profile", error);
            if (get().profile !== optimisticProfile) return;
            set(previousSnapshot);
          });
      },
      setDietaryPreferences: (dietaryPreferences) => {
        const previousProfile = get().profile;
        set((state) => {
          // Religious and health diets are sensitive (PDPA): only how many were picked is sent.
          trackAnalyticsEvent("dietary_preferences_set", {
            flag_count: dietaryPreferences.length,
          });
          return {
            profile: {
              ...state.profile,
              dietaryPreferences,
            },
          };
        });
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateDietaryPreferences(dietaryPreferences)
          .catch((error) => {
            console.error("Failed to sync dietary preferences", error);
            if (get().profile !== optimisticProfile) return;
            set({ profile: previousProfile });
          });
      },
      setMaxDishBudget: (maxDishBudget) => {
        trackAnalyticsEvent("budget_preference_set", { max_dish_budget: maxDishBudget ?? null });
        const previousProfile = get().profile;
        set((state) => ({ profile: { ...state.profile, maxDishBudget } }));
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateMaxDishBudget(maxDishBudget ?? null)
          .catch((error) => {
            console.error("Failed to sync dish budget", error);
            if (get().profile !== optimisticProfile) return;
            set({ profile: previousProfile });
          });
      },
      addReview: (dish) =>
        set((state) => {
          const reviewedDishIds = state.profile.reviewedDishIds.includes(dish.id)
            ? state.profile.reviewedDishIds
            : [...state.profile.reviewedDishIds, dish.id];

          return {
            profile: {
              ...state.profile,
              reviewedDishIds,
              stats: {
                ...state.profile.stats,
                // Each posted review counts; "Tried" taps never do.
                dishesReviewed: state.profile.stats.dishesReviewed + 1,
              },
            },
          };
        }),
      addReviewedDish: (dishId) =>
        set((state) => {
          const alreadyTried = state.profile.reviewedDishIds.includes(dishId);
          const reviewedDishIds = alreadyTried
            ? state.profile.reviewedDishIds
            : [...state.profile.reviewedDishIds, dishId];
          if (!alreadyTried) {
            trackActivationOnce(state.profile, "tried", dishId);
          }

          // Tried is not a review: stats.dishesReviewed is left alone.
          return { profile: { ...state.profile, reviewedDishIds } };
        }),
      removeReviewedDish: (dishId) =>
        set((state) => {
          const reviewedDishIds = state.profile.reviewedDishIds.filter((id) => id !== dishId);
          return { profile: { ...state.profile, reviewedDishIds } };
        }),
      setDishTried: async (dishId, tried) => {
        const previousIds = get().profile.reviewedDishIds;
        if (tried) get().addReviewedDish(dishId);
        else get().removeReviewedDish(dishId);
        if (!shouldSyncAuthenticatedProfile(get().profile)) return true;
        try {
          const savedIds = await getHungryService().profile.setDishTried(dishId, tried);
          set((state) => ({ profile: { ...state.profile, reviewedDishIds: savedIds } }));
          return true;
        } catch (error) {
          console.error("Failed to save the Tried mark", error);
          set((state) => ({ profile: { ...state.profile, reviewedDishIds: previousIds } }));
          return false;
        }
      },
      recordReviewEntry: (dishId, entry) => {
        let recordedEvent: TasteInteractionEvent | undefined;
        let interactionInput: RecordTasteInteractionInput | undefined;
        set((state) => {
          const dish = getDataRepository().getDishById(dishId);
          if (!dish) {
            return {
              reviewEntries: {
                ...state.reviewEntries,
                [dishId]: {
                  ...entry,
                  text: entry.text.trim(),
                  createdAt: new Date().toISOString(),
                },
              },
            };
          }

          const feedbackType = getRatingFeedbackType(entry.rating);
          const updatedTasteVector = processExplicitFeedback(state.profile.tasteVector, {
            type: feedbackType,
            dishVector: dish.tasteVector,
            timestamp: Date.now(),
          });
          interactionInput = { type: "review", surface: "review", dish, rating: entry.rating };
          const event = createTasteEvent(
            interactionInput,
            state.profile.tasteVector,
            updatedTasteVector,
            true,
          );
          recordedEvent = event;

          return {
            reviewEntries: {
              ...state.reviewEntries,
              [dishId]: {
                ...entry,
                text: entry.text.trim(),
                createdAt: new Date().toISOString(),
              },
            },
            profile: {
              ...state.profile,
              tasteVector: updatedTasteVector,
              recommendationSignals: bumpRecommendationSignals(state.profile, feedbackType),
            },
            tasteProfile: {
              ...state.tasteProfile,
              vector: updatedTasteVector,
            },
            tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
          };
        });
        if (interactionInput) {
          persistTasteInteraction(interactionInput, recordedEvent);
        }
      },
      recordTasteInteraction: (rawInput) => {
        // Settings > "Allow search history" off: no search signal and no query text is kept.
        const allowSearchHistory = useUIStore.getState().allowSearchHistory;
        if (!allowSearchHistory && rawInput.type === "search_query") return undefined;
        const input = allowSearchHistory ? rawInput : { ...rawInput, query: undefined };
        let recordedEvent: TasteInteractionEvent | undefined;
        set((state) => {
          const feedbackType = getInteractionFeedbackType(input);
          const interactionVector = resolveInteractionVector(input, state.profile);
          const capped = isCappedInteraction(state.tasteInteractionEvents, input);

          if (!feedbackType || !interactionVector || capped) {
            const reason: TasteInteractionEvent["reason"] = capped ? "capped" : "missing_signal";
            const event = createTasteEvent(
              input,
              state.profile.tasteVector,
              state.profile.tasteVector,
              false,
              reason,
            );
            recordedEvent = event;
            return {
              tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
            };
          }

          const updatedTasteVector = processExplicitFeedback(state.profile.tasteVector, {
            type: feedbackType,
            dishVector: interactionVector,
            dishConfidence: input.dish?.tasteConfidence,
            timestamp: Date.now(),
          });
          const event = createTasteEvent(
            input,
            state.profile.tasteVector,
            updatedTasteVector,
            true,
          );
          recordedEvent = event;

          trackAnalyticsEvent("taste_interaction_recorded", {
            type: input.type,
            surface: input.surface,
            dish_id: input.dish?.id ?? input.dishId,
            query: input.query,
            applied: true,
          });

          return {
            profile: {
              ...state.profile,
              tasteVector: updatedTasteVector,
              recommendationSignals: bumpRecommendationSignals(state.profile, feedbackType),
            },
            tasteProfile: {
              ...state.tasteProfile,
              vector: updatedTasteVector,
            },
            tasteInteractionEvents: appendTasteEvent(state.tasteInteractionEvents, event),
          };
        });
        const affinitySignal = getAffinitySignal(input, recordedEvent);
        const affinityDishId = input.dish?.id ?? input.dishId;
        if (affinitySignal && affinityDishId) {
          const dish = input.dish ?? getDataRepository().getDishById(affinityDishId);
          set((state) => {
            const existing = state.foodHistory.find((row) => row.dishId === affinityDishId);
            const next = applyAffinityEvent(existing, {
              dishId: affinityDishId,
              signal: affinitySignal,
              foodType: dish?.foodTypeTag,
              venueId: dish?.venueId,
            });
            return {
              foodHistory: [
                next,
                ...state.foodHistory.filter((row) => row.dishId !== affinityDishId),
              ],
            };
          });
        }
        persistTasteInteraction(input, recordedEvent);
        return recordedEvent;
      },
      clearProfile: () =>
        set({
          profile: withNeutralTasteProfile(
            ensureSupabaseCompatibleProfile(getDataRepository().getProfile(false)),
          ),
          tasteProfile: NEUTRAL_TASTE_PROFILE,
          tasteInteractionEvents: [],
          reviewEntries: {},
          favouritesRehydrationFailed: false,
          foodHistory: [],
        }),
    }),
    {
      name: "hungry-profile-v1",
      storage: hungryPersistStorage,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.profile) {
          state.profile = withNeutralTasteProfile(SUPABASE_USER_GUEST_PROFILE);
          state.tasteProfile = NEUTRAL_TASTE_PROFILE;
          return;
        }

        state.profile = withNeutralTasteProfile(
          ensureSupabaseCompatibleProfile(state.profile as UserProfile),
        );
        if (!state.tasteProfile) {
          state.tasteProfile = NEUTRAL_TASTE_PROFILE;
        }
      },
      partialize: (state) => ({
        profile: state.profile,
        tasteProfile: state.tasteProfile,
        tasteInteractionEvents: state.tasteInteractionEvents,
        reviewEntries: state.reviewEntries,
        foodHistory: state.foodHistory,
      }),
    },
  ),
);

/** Same signals the server trigger counts (20261020080000); saves and ratings come from favourites and reviews. */
function getAffinitySignal(
  input: RecordTasteInteractionInput,
  event: TasteInteractionEvent | undefined,
): AffinitySignal | undefined {
  if (input.type === "dismissed") return "dismissed";
  if (!event?.applied) return undefined;
  if (input.type === "dish_like") return "dish_like";
  if (input.type === "dish_result_click" || input.type === "food_button_click") return "click";
  return undefined;
}

/** Food history for ranking: stored rows, plus favourites and tried dishes the rows do not cover yet. */
export function selectFoodHistoryRows(
  state: Pick<ProfileState, "foodHistory" | "profile">,
): UserDishAffinity[] {
  const repository = getDataRepository();
  return mergeFoodHistory(
    state.foodHistory,
    deriveLocalFoodHistory(state.profile, (dishId) => repository.getDishById(dishId)),
  );
}

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(getSimilarityScore(profile.tasteVector, dish.tasteVector) * 100);
