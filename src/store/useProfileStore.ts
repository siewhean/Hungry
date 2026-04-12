import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
import type { DietaryFlag, DishDetail, TasteVector, UserProfile } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface ProfileState {
  profile: UserProfile;
  reviewEntries: Record<string, { rating: number; text: string; tags: string[]; createdAt: string }>;
  syncProfile: (isAuthenticated: boolean) => void;
  toggleFavourite: (dish: DishDetail) => void;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email">>) => void;
  setTasteVector: (tasteVector: TasteVector) => void;
  setDietaryPreferences: (dietaryPreferences: DietaryFlag[]) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
  recordReviewEntry: (dishId: string, entry: { rating: number; text: string; tags: string[] }) => void;
  setLeftHandedMode: (enabled: boolean) => void;
  setOnboardingSelectedDishIds: (dishIds: string[]) => void;
  clearProfile: () => void;
}

function recalculateTasteVector(profile: UserProfile) {
  const repository = getDataRepository();
  const favourites = profile.favouriteDishIds
    .map((id) => repository.getDishById(id))
    .filter((d): d is DishDetail => !!d);

  if (favourites.length === 0) return profile.tasteVector;

  const newVector: TasteVector = { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 };
  favourites.forEach((dish) => {
    Object.keys(newVector).forEach((key) => {
      (newVector as any)[key] += (dish.tasteVector as any)[key];
    });
  });

  Object.keys(newVector).forEach((key) => {
    (newVector as any)[key] = Math.round((newVector as any)[key] / favourites.length);
  });

  return newVector;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: getDataRepository().getProfile(false),
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
          };

          return {
            profile: {
              ...nextProfile,
              tasteVector: recalculateTasteVector(nextProfile),
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
        set((state) => ({
          reviewEntries: {
            ...state.reviewEntries,
            [dishId]: {
              ...entry,
              text: entry.text.trim(),
              createdAt: new Date().toISOString(),
            },
          },
        })),
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
          reviewEntries: {  },
        }),
    }),
    {
      name: "hungry-profile-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        profile: state.profile,
        reviewEntries: state.reviewEntries,
      }),
    },
  ),
);

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(getSimilarityScore(profile.tasteVector, dish.tasteVector) * 100);
