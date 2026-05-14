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
  DishDetail,
  RecommendationSurface,
  ProfileVisibility,
  TasteProfile,
  TasteInteractionEvent,
  TasteInteractionType,
  TasteVector,
  UserProfile,
} from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE } from "@/constants/taste";
import { hungryPersistStorage } from "./persistStorage";

interface ProfileState {
  profile: UserProfile;
  /** Extended taste profile with psychometric secondary axes */
  tasteProfile: TasteProfile;
  tasteInteractionEvents: TasteInteractionEvent[];
  reviewEntries: Record<
    string,
    { rating: number; text: string; tags: string[]; createdAt: string }
  >;
  applyProfile: (profile: UserProfile) => void;
  syncProfile: (isAuthenticated: boolean) => void;
  toggleFavourite: (dish: DishDetail) => void;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email" | "avatarUrl">>) => void;
  setProfileVisibility: (profileVisibility: ProfileVisibility) => void;
  setTasteVector: (tasteVector: TasteVector) => void;
  setTasteProfile: (tasteProfile: TasteProfile) => void;
  setDietaryPreferences: (dietaryPreferences: DietaryFlag[]) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
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
      profile: getDataRepository().getProfile(false),
      tasteProfile: NEUTRAL_TASTE_PROFILE,
      tasteInteractionEvents: [],
      reviewEntries: {},
      applyProfile: (profile) =>
        set({
          profile,
          tasteProfile: profile.tasteProfile ?? {
            ...NEUTRAL_TASTE_PROFILE,
            vector: profile.tasteVector,
          },
        }),
      syncProfile: (isAuthenticated) => {
        set({ profile: getDataRepository().getProfile(isAuthenticated) });
      },
      toggleFavourite: (dish) => {
        let recordedEvent: TasteInteractionEvent | undefined;
        let interactionInput: RecordTasteInteractionInput | undefined;
        set((state) => {
          const isFavourite = state.profile.favouriteDishIds.includes(dish.id);
          const nextIds = isFavourite
            ? state.profile.favouriteDishIds.filter((id) => id !== dish.id)
            : [...state.profile.favouriteDishIds, dish.id];
          const feedbackType: ExplicitFeedbackEvent["type"] = isFavourite ? "unsaved" : "saved";
          const updatedTasteVector = processExplicitFeedback(state.profile.tasteVector, {
            type: feedbackType,
            dishVector: dish.tasteVector,
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
      },
      updateProfile: (next) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...next,
          },
        })),
      setProfileVisibility: (profileVisibility) => {
        const currentVisibility = get().profile.profileVisibility;
        if (currentVisibility === profileVisibility) return;
        set((state) => ({
          profile: {
            ...state.profile,
            profileVisibility,
          },
        }));
        if (getServiceProvider().mode === "mock") {
          return;
        }
        void getHungryService()
          .profile.updateProfile({ profileVisibility })
          .catch((error) => {
            console.error("Failed to update profile visibility", error);
          });
      },
      setTasteVector: (tasteVector) =>
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
        }),
      setTasteProfile: (tasteProfile) =>
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
        }),
      setDietaryPreferences: (dietaryPreferences) =>
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
        }),
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
          profile: getDataRepository().getProfile(false),
          tasteProfile: NEUTRAL_TASTE_PROFILE,
          tasteInteractionEvents: [],
          reviewEntries: {},
        }),
    }),
    {
      name: "hungry-profile-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        profile: state.profile,
        tasteProfile: state.tasteProfile,
        tasteInteractionEvents: state.tasteInteractionEvents,
        reviewEntries: state.reviewEntries,
      }),
    },
  ),
);

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(getSimilarityScore(profile.tasteVector, dish.tasteVector) * 100);
