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
import type {
  DietaryFlag,
  Coordinate,
  DishDetail,
  RecommendationSurface,
  ProfileVisibility,
  TasteProfile,
  TasteInteractionEvent,
  TasteInteractionType,
  TasteVector,
  UserProfile,
} from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE, NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { hungryPersistStorage } from "./persistStorage";
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

/**
 * A durable snapshot of onboarding choices that have not yet been confirmed
 * by the authenticated profile write. Device location intentionally remains a
 * device preference, but it is captured alongside the shared choices so a
 * failed profile migration never loses the completed onboarding state.
 */
export interface ProvisionalOnboardingMigration {
  userId: string;
  onboardingVersion: 1;
  capturedAt: string;
  tasteProfile?: TasteProfile;
  dietaryPreferences: DietaryFlag[];
  location: {
    permission: "unknown" | "granted" | "denied";
    currentLocation: Coordinate;
    manualLocation?: string;
    manualCoordinate?: Coordinate;
    gpsBadgeState: "live" | "manual" | "denied";
  };
}

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
  provisionalOnboardingMigration?: ProvisionalOnboardingMigration;
  applyProfile: (profile: UserProfile) => void;
  setProvisionalOnboardingMigration: (migration: ProvisionalOnboardingMigration) => void;
  clearProvisionalOnboardingMigration: (userId: string) => void;
  syncProfile: (isAuthenticated: boolean, userId?: string | null) => void;
  toggleFavourite: (dish: FavouriteDishInput) => Promise<FavouriteToggleResult>;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email" | "avatarUrl">>) => void;
  setProfileVisibility: (profileVisibility: ProfileVisibility) => void;
  setTasteVector: (tasteVector: TasteVector) => void;
  setTasteProfile: (tasteProfile: TasteProfile) => void;
  setDietaryPreferences: (dietaryPreferences: DietaryFlag[]) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
  removeReviewedDish: (dishId: string) => void;
  recordReviewEntry: (
    dishId: string,
    entry: { rating: number; text: string; tags: string[] },
  ) => void;
  recordTasteInteraction: (input: RecordTasteInteractionInput) => TasteInteractionEvent | undefined;
  setLeftHandedMode: (enabled: boolean) => void;
  setOnboardingSelectedDishIds: (dishIds: string[]) => void;
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

/** Legacy screens pass a full dish; Release 0.1 catalog screens pass only ids. */
export type FavouriteDishInput = DishDetail | Pick<DishDetail, "id" | "venueId">;

/** Resolved only after the authenticated write settles, so UI never claims an unsaved write. */
export type FavouriteToggleResult =
  | { status: "saved" | "removed" }
  | { status: "failed"; reason: "pending" | "signed_out" | "sync_failed"; message: string };

function isFullFavouriteDish(dish: FavouriteDishInput): dish is DishDetail {
  return "tasteVector" in dish && Boolean(dish.tasteVector);
}

function setFavouriteMembership(
  set: (fn: (state: ProfileState) => Partial<ProfileState>) => void,
  dishId: string,
  isFavourite: boolean,
) {
  set((state) => {
    const hasDish = state.profile.favouriteDishIds.includes(dishId);
    if (hasDish === isFavourite) return {};
    const nextIds = isFavourite
      ? [...state.profile.favouriteDishIds, dishId]
      : state.profile.favouriteDishIds.filter((id) => id !== dishId);
    return {
      profile: {
        ...state.profile,
        favouriteDishIds: nextIds,
        stats: { ...state.profile.stats, favouritesCount: nextIds.length },
      },
    };
  });
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
  if (!event || getServiceProvider().mode !== "supabase") {
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
      provisionalOnboardingMigration: undefined,
      applyProfile: (profile) =>
        set({
          profile: withNeutralTasteProfile(ensureSupabaseCompatibleProfile(profile)),
          tasteProfile: profile.tasteProfile ?? {
            ...NEUTRAL_TASTE_PROFILE,
            vector: profile.tasteVector,
          },
        }),
      setProvisionalOnboardingMigration: (migration) =>
        set({ provisionalOnboardingMigration: migration }),
      clearProvisionalOnboardingMigration: (userId) =>
        set((state) =>
          state.provisionalOnboardingMigration?.userId === userId
            ? { provisionalOnboardingMigration: undefined }
            : {},
        ),
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
            });
        };

        if (isAuthenticated && userId && currentProfile.id === userId) {
          rehydrateFavouriteDishIds();
          return;
        }

        set({
          profile: withNeutralTasteProfile(
            ensureSupabaseCompatibleProfile(
              getDataRepository().getProfile(isAuthenticated, userId),
            ),
          ),
          tasteProfile: NEUTRAL_TASTE_PROFILE,
        });
        rehydrateFavouriteDishIds();
      },
      toggleFavourite: async (dish) => {
        const dishId = dish.id;
        if (pendingFavouriteDishToggles.has(dishId)) {
          return {
            status: "failed",
            reason: "pending",
            message: "Still saving your last change. Try again in a moment.",
          };
        }
        if (!getSessionStoreState().isAuthenticated) {
          console.warn("Favourite toggle ignored because the user is signed out.");
          return { status: "failed", reason: "signed_out", message: "Sign in to save favourites." };
        }
        pendingFavouriteDishToggles.add(dishId);
        const previousSnapshot = {
          profile: get().profile,
          tasteProfile: get().tasteProfile,
          tasteInteractionEvents: get().tasteInteractionEvents,
        };
        const wasFavourite = previousSnapshot.profile.favouriteDishIds.includes(dishId);
        // Catalog (release) dishes carry no taste vector; they only toggle membership.
        const tasteDish = isFullFavouriteDish(dish) ? dish : undefined;
        let recordedEvent: TasteInteractionEvent | undefined;
        let interactionInput: RecordTasteInteractionInput | undefined;
        set((state) => {
          const isFavourite = state.profile.favouriteDishIds.includes(dishId);
          const nextIds = isFavourite
            ? state.profile.favouriteDishIds.filter((id) => id !== dishId)
            : [...state.profile.favouriteDishIds, dishId];
          const feedbackType: ExplicitFeedbackEvent["type"] = isFavourite ? "unsaved" : "saved";

          trackAnalyticsEvent(isFavourite ? "dish_unfavourited" : "dish_favourited", {
            dish_id: dish.id,
            venue_id: dish.venueId,
          });

          if (!tasteDish) {
            return {
              profile: {
                ...state.profile,
                favouriteDishIds: nextIds,
                stats: { ...state.profile.stats, favouritesCount: nextIds.length },
              },
            };
          }

          const updatedTasteVector = processExplicitFeedback(state.profile.tasteVector, {
            type: feedbackType,
            dishVector: tasteDish.tasteVector,
            timestamp: Date.now(),
          });
          interactionInput = {
            type: isFavourite ? "unsaved" : "saved",
            surface: "profile",
            dish: tasteDish,
          };
          const event = createTasteEvent(
            interactionInput,
            state.profile.tasteVector,
            updatedTasteVector,
            true,
          );
          recordedEvent = event;

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
        if (getServiceProvider().mode === "mock") {
          pendingFavouriteDishToggles.delete(dishId);
          return { status: wasFavourite ? "removed" : "saved" };
        }

        const optimisticProfile = get().profile;
        try {
          const saved = await getHungryService().profile.toggleFavourite(dishId);
          // The server toggles its own row; if local state was stale, adopt the server result.
          setFavouriteMembership(set, dishId, saved);
          return { status: saved ? "saved" : "removed" };
        } catch (error) {
          console.error("Failed to sync favourite toggle", error);
          if (get().profile === optimisticProfile) {
            set(previousSnapshot);
          } else {
            setFavouriteMembership(set, dishId, wasFavourite);
          }
          return {
            status: "failed",
            reason: "sync_failed",
            message: "Couldn't update your favourites. Check your connection and try again.",
          };
        } finally {
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
      setProfileVisibility: (profileVisibility) => {
        const currentVisibility = get().profile.profileVisibility;
        if (currentVisibility === profileVisibility) return;
        const previousProfile = get().profile;
        set((state) => ({
          profile: {
            ...state.profile,
            profileVisibility,
          },
        }));
        const optimisticProfile = get().profile;
        if (!shouldSyncAuthenticatedProfile(optimisticProfile)) {
          return;
        }
        void getHungryService()
          .profile.updateProfile({ profileVisibility })
          .catch((error) => {
            console.error("Failed to update profile visibility", error);
            if (get().profile !== optimisticProfile) return;
            set({ profile: previousProfile });
          });
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
          trackAnalyticsEvent("dietary_preferences_set", {
            flags: dietaryPreferences,
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
                dishesReviewed: reviewedDishIds.length,
              },
            },
          };
        }),
      addReviewedDish: (dishId) =>
        set((state) => {
          const reviewedDishIds = state.profile.reviewedDishIds.includes(dishId)
            ? state.profile.reviewedDishIds
            : [...state.profile.reviewedDishIds, dishId];

          return {
            profile: {
              ...state.profile,
              reviewedDishIds,
              stats: {
                ...state.profile.stats,
                dishesReviewed: reviewedDishIds.length,
              },
            },
          };
        }),
      removeReviewedDish: (dishId) =>
        set((state) => {
          const reviewedDishIds = state.profile.reviewedDishIds.filter((id) => id !== dishId);
          return {
            profile: {
              ...state.profile,
              reviewedDishIds,
              stats: {
                ...state.profile.stats,
                dishesReviewed: reviewedDishIds.length,
              },
            },
          };
        }),
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
      recordTasteInteraction: (input) => {
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
        persistTasteInteraction(input, recordedEvent);
        return recordedEvent;
      },
      setLeftHandedMode: (enabled) =>
        set((state) => ({
          profile: {
            ...state.profile,
            leftHandedMode: enabled,
          },
        })),
      setOnboardingSelectedDishIds: (dishIds) =>
        set((state) => ({
          profile: {
            ...state.profile,
            onboardingSelectedDishIds: dishIds,
          },
        })),
      clearProfile: () =>
        set({
          profile: withNeutralTasteProfile(
            ensureSupabaseCompatibleProfile(getDataRepository().getProfile(false)),
          ),
          tasteProfile: NEUTRAL_TASTE_PROFILE,
          tasteInteractionEvents: [],
          reviewEntries: {},
          provisionalOnboardingMigration: undefined,
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
        provisionalOnboardingMigration: state.provisionalOnboardingMigration,
      }),
    },
  ),
);

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(getSimilarityScore(profile.tasteVector, dish.tasteVector) * 100);
