import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { processExplicitFeedback, type ExplicitFeedbackEvent } from "@/lib/ai/tasteEngine";
import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
import type {
  DietaryFlag,
  DishDetail,
  TasteProfile,
  TasteVector,
  UserProfile,
} from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE } from "@/constants/taste";
import { hungryPersistStorage } from "./persistStorage";

interface ProfileState {
  profile: UserProfile;
  /** Extended taste profile with psychometric secondary axes */
  tasteProfile: TasteProfile;
  reviewEntries: Record<
    string,
    { rating: number; text: string; tags: string[]; createdAt: string }
  >;
  syncProfile: (isAuthenticated: boolean) => void;
  toggleFavourite: (dish: DishDetail) => void;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email">>) => void;
  setTasteVector: (tasteVector: TasteVector) => void;
  setTasteProfile: (tasteProfile: TasteProfile) => void;
  setDietaryPreferences: (dietaryPreferences: DietaryFlag[]) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
  recordReviewEntry: (
    dishId: string,
    entry: { rating: number; text: string; tags: string[] },
  ) => void;
  setLeftHandedMode: (enabled: boolean) => void;
  setOnboardingSelectedDishIds: (dishIds: string[]) => void;
  clearProfile: () => void;
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

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: getDataRepository().getProfile(false),
      tasteProfile: NEUTRAL_TASTE_PROFILE,
      reviewEntries: {},
      syncProfile: (isAuthenticated) => {
        set({ profile: getDataRepository().getProfile(isAuthenticated) });
      },
      toggleFavourite: (dish) =>
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
          };
        }),
      updateProfile: (next) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...next,
          },
        })),
      setTasteVector: (tasteVector) =>
        set((state) => {
          trackAnalyticsEvent("taste_quiz_completed", {
            skipped: false,
            vector: tasteVector,
          });
          return {
            profile: {
              ...state.profile,
              tasteVector,
            },
            tasteProfile: {
              ...state.tasteProfile,
              vector: tasteVector,
            },
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
          return {
            profile: {
              ...state.profile,
              tasteVector: tasteProfile.vector,
              tasteProfile,
            },
            tasteProfile,
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
      recordReviewEntry: (dishId, entry) =>
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
          };
        }),
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
          reviewEntries: {},
        }),
    }),
    {
      name: "hungry-profile-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        profile: state.profile,
        tasteProfile: state.tasteProfile,
        reviewEntries: state.reviewEntries,
      }),
    },
  ),
);

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(getSimilarityScore(profile.tasteVector, dish.tasteVector) * 100);
