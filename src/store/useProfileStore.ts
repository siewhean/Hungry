import { create } from "zustand";

import { guestProfile, userProfile } from "@/lib/services/mock/data";
import { mockRepository, similarityScore } from "@/lib/services/mock/repositories";
import type { DietaryFlag, DishDetail, TasteVector, UserProfile } from "@/types/domain";

interface ProfileState {
  profile: UserProfile;
  syncProfile: (isAuthenticated: boolean) => void;
  toggleFavourite: (dish: DishDetail) => void;
  updateProfile: (next: Partial<Pick<UserProfile, "displayName" | "email">>) => void;
  updateTasteVector: (vector: TasteVector) => void;
  updateDietaryPreferences: (flags: DietaryFlag[]) => void;
  addReview: (dish: DishDetail) => void;
  addReviewedDish: (dishId: string) => void;
}

function recalculateTasteVector(profile: UserProfile) {
  const favourites = profile.favouriteDishIds
    .map((dishId) => mockRepository.getDishById(dishId))
    .filter(Boolean) as DishDetail[];

  if (!favourites.length) {
    return profile.tasteVector;
  }

  const next = { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 };
  favourites.forEach((dish) => {
    next.sweet += dish.tasteVector.sweet;
    next.spicy += dish.tasteVector.spicy;
    next.sour += dish.tasteVector.sour;
    next.salty += dish.tasteVector.salty;
    next.rich += dish.tasteVector.rich;
    next.aromatic += dish.tasteVector.aromatic;
  });

  return {
    sweet: next.sweet / favourites.length,
    spicy: next.spicy / favourites.length,
    sour: next.sour / favourites.length,
    salty: next.salty / favourites.length,
    rich: next.rich / favourites.length,
    aromatic: next.aromatic / favourites.length,
  };
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: guestProfile,
  syncProfile: (isAuthenticated) => set({ profile: isAuthenticated ? userProfile : guestProfile }),
  toggleFavourite: (dish) =>
    set((state) => {
      const favouriteDishIds = state.profile.favouriteDishIds.includes(dish.id)
        ? state.profile.favouriteDishIds.filter((dishId) => dishId !== dish.id)
        : [...state.profile.favouriteDishIds, dish.id];

      const profile = {
        ...state.profile,
        favouriteDishIds,
        stats: {
          ...state.profile.stats,
          favouritesCount: favouriteDishIds.length,
        },
      };

      return {
        profile: {
          ...profile,
          tasteVector: recalculateTasteVector(profile),
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
  updateTasteVector: (vector) =>
    set((state) => ({
      profile: {
        ...state.profile,
        tasteVector: vector,
      },
    })),
  updateDietaryPreferences: (flags) =>
    set((state) => ({
      profile: {
        ...state.profile,
        dietaryPreferences: flags,
      },
    })),
  addReview: (dish) =>
    set((state) => {
      const reviewedDishIds = state.profile.reviewedDishIds.includes(dish.id)
        ? state.profile.reviewedDishIds
        : [...state.profile.reviewedDishIds, dish.id];
      const reviewedVenueIds = new Set(
        reviewedDishIds
          .map((dishId) => mockRepository.getDishById(dishId)?.venueId)
          .filter(Boolean) as string[],
      );

      return {
        profile: {
          ...state.profile,
          reviewedDishIds,
          stats: {
            ...state.profile.stats,
            dishesReviewed: reviewedDishIds.length,
            stallsVisited: reviewedVenueIds.size,
          },
        },
      };
    }),
  addReviewedDish: (dishId) =>
    set((state) => {
      if (state.profile.reviewedDishIds.includes(dishId)) {
        return state;
      }

      const reviewedDishIds = [...state.profile.reviewedDishIds, dishId];
      const reviewedVenueIds = new Set(
        reviewedDishIds
          .map((reviewedId) => mockRepository.getDishById(reviewedId)?.venueId)
          .filter(Boolean) as string[],
      );

      return {
        profile: {
          ...state.profile,
          reviewedDishIds,
          stats: {
            ...state.profile.stats,
            dishesReviewed: reviewedDishIds.length,
            stallsVisited: reviewedVenueIds.size,
          },
        },
      };
    }),
}));

export const getTasteSimilarityWithDish = (profile: UserProfile, dish: DishDetail) =>
  Math.round(similarityScore(profile.tasteVector, dish.tasteVector) * 100);
