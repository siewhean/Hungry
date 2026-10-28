import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MEAL_KEYS, type MealTimes } from "@/features/onboarding/mealTimes";
import { hungryPersistStorage } from "./persistStorage";

/** The most usual areas a person can pick. */
export const MAX_USUAL_AREAS = 3;
/** The most dish signals kept for the account step; the rest are dropped, oldest first. */
export const MAX_TASTE_SIGNALS = 30;
/** The longest name the first screen accepts. */
export const MAX_ONBOARDING_NAME_LENGTH = 40;

/** Trims a typed name and cuts it at the limit. */
export function cleanOnboardingName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_ONBOARDING_NAME_LENGTH);
}

interface OnboardingAnswersState {
  /** What to call the person; carried into the account step. Empty until they type it. */
  displayName: string;
  /** Singapore area ids (see singaporeAreas.ts) the person eats around most, up to three. */
  usualAreaIds: string[];
  /** Usual start time per meal, "HH:MM" 24-hour. A meal that is missing was not picked. */
  mealTimes: MealTimes;
  /** Dishes the person hearted in the grid or swiped right, newest last. Sent after sign-in. */
  likedDishIds: string[];
  /** Dishes the person swiped away. Sent after sign-in. */
  passedDishIds: string[];
  /** True once the person asked for lunch and dinner picks (the account step switches them on). */
  wantsMealPicks: boolean;
  setDisplayName: (name: string) => void;
  toggleUsualArea: (areaId: string) => boolean;
  setMealTimes: (times: MealTimes) => void;
  /** Hearts or un-hearts a dish; a dish is never both liked and passed. */
  toggleLikedDish: (dishId: string) => void;
  /** Records a swipe: right is a like, left is a pass. */
  recordSwipe: (dishId: string, liked: boolean) => void;
  setWantsMealPicks: (wants: boolean) => void;
  /** Takes the signals out (to send them) and leaves the other answers in place. */
  takeTasteSignals: () => { liked: string[]; passed: string[]; wantsMealPicks: boolean };
  reset: () => void;
}

const EMPTY = {
  displayName: "",
  usualAreaIds: [] as string[],
  mealTimes: {} as MealTimes,
  likedDishIds: [] as string[],
  passedDishIds: [] as string[],
  wantsMealPicks: false,
};

function addCapped(list: readonly string[], id: string): string[] {
  return [...list.filter((item) => item !== id), id].slice(-MAX_TASTE_SIGNALS);
}

/**
 * What the new onboarding asks that no other store holds yet: a name, the areas, the meal
 * times, the dishes liked or passed, and the meal-picks opt-in. Kept on the device; the dish
 * signals and the opt-in are sent once an account exists (flushOnboardingAnswers).
 */
export const useOnboardingAnswersStore = create<OnboardingAnswersState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      setDisplayName: (name) => set({ displayName: cleanOnboardingName(name) }),
      // Returns false when a fourth area was refused.
      toggleUsualArea: (areaId) => {
        const current = get().usualAreaIds;
        if (current.includes(areaId)) {
          set({ usualAreaIds: current.filter((id) => id !== areaId) });
          return true;
        }
        if (current.length >= MAX_USUAL_AREAS) return false;
        set({ usualAreaIds: [...current, areaId] });
        return true;
      },
      setMealTimes: (mealTimes) => {
        const kept: MealTimes = {};
        for (const meal of MEAL_KEYS) if (mealTimes[meal]) kept[meal] = mealTimes[meal];
        set({ mealTimes: kept });
      },
      toggleLikedDish: (dishId) => {
        const { likedDishIds, passedDishIds } = get();
        set(
          likedDishIds.includes(dishId)
            ? { likedDishIds: likedDishIds.filter((id) => id !== dishId) }
            : {
                likedDishIds: addCapped(likedDishIds, dishId),
                passedDishIds: passedDishIds.filter((id) => id !== dishId),
              },
        );
      },
      recordSwipe: (dishId, liked) => {
        const { likedDishIds, passedDishIds } = get();
        set(
          liked
            ? {
                likedDishIds: addCapped(likedDishIds, dishId),
                passedDishIds: passedDishIds.filter((id) => id !== dishId),
              }
            : {
                passedDishIds: addCapped(passedDishIds, dishId),
                likedDishIds: likedDishIds.filter((id) => id !== dishId),
              },
        );
      },
      setWantsMealPicks: (wantsMealPicks) => set({ wantsMealPicks }),
      takeTasteSignals: () => {
        const { likedDishIds, passedDishIds, wantsMealPicks } = get();
        set({ likedDishIds: [], passedDishIds: [], wantsMealPicks: false });
        return { liked: likedDishIds, passed: passedDishIds, wantsMealPicks };
      },
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: "hungry-onboarding-answers-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        displayName: state.displayName,
        usualAreaIds: state.usualAreaIds,
        mealTimes: state.mealTimes,
        likedDishIds: state.likedDishIds,
        passedDishIds: state.passedDishIds,
        wantsMealPicks: state.wantsMealPicks,
      }),
    },
  ),
);
