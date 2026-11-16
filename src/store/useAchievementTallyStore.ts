import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ACHIEVEMENT_BUDGET_PRICE,
  ACHIEVEMENT_TASTE_THRESHOLD,
} from "@/features/achievements/achievements";
import { normalizeFoodType } from "@/lib/ai/foodHistory";
import type { DishDetail, TasteVector } from "@/types/domain";

import { hungryPersistStorage } from "./persistStorage";

/** What an achievement needs to know about a tried dish, kept so it is counted once. */
export type TriedDishFacts = {
  spicy: boolean;
  sweet: boolean;
  budget: boolean;
  /** The taste that leads the dish (at the achievement threshold), for Taste explorer. */
  lead?: keyof TasteVector;
  /** The dish's kind of food, for Food explorer. */
  foodType?: string;
};

/** The strongest taste at or over the threshold, or undefined for an untagged or mild dish. */
export function leadTaste(
  vector: TasteVector | undefined,
  hasTasteSignal: boolean,
): keyof TasteVector | undefined {
  if (!hasTasteSignal || !vector) return undefined;
  let lead: keyof TasteVector | undefined;
  for (const key of Object.keys(vector) as (keyof TasteVector)[]) {
    if ((vector[key] ?? 0) < ACHIEVEMENT_TASTE_THRESHOLD) continue;
    if (!lead || vector[key] > vector[lead]) lead = key;
  }
  return lead;
}

/** Reads the achievement facts from a dish; an untagged dish never counts as spicy or sweet. */
export function triedDishFacts(
  dish: Pick<DishDetail, "tasteVector" | "price" | "tasteConfidence"> &
    Partial<Pick<DishDetail, "foodTypeTag">>,
  hasTasteSignal: boolean,
): TriedDishFacts {
  const lead = leadTaste(dish.tasteVector, hasTasteSignal);
  const foodType = normalizeFoodType(dish.foodTypeTag);
  return {
    spicy: hasTasteSignal && (dish.tasteVector.spicy ?? 0) >= ACHIEVEMENT_TASTE_THRESHOLD,
    sweet: hasTasteSignal && (dish.tasteVector.sweet ?? 0) >= ACHIEVEMENT_TASTE_THRESHOLD,
    budget: dish.price > 0 && dish.price <= ACHIEVEMENT_BUDGET_PRICE,
    ...(lead ? { lead } : {}),
    ...(foodType ? { foodType } : {}),
  };
}

interface AchievementTallyState {
  /** Facts for dishes each diner marked tried, by user id then dish id. */
  triedByUser: Record<string, Record<string, TriedDishFacts>>;
  recordTriedDish: (userId: string, dishId: string, facts: TriedDishFacts) => void;
  forgetTriedDish: (userId: string, dishId: string) => void;
}

export const useAchievementTallyStore = create<AchievementTallyState>()(
  persist(
    (set, get) => ({
      triedByUser: {},
      recordTriedDish: (userId, dishId, facts) =>
        set({
          triedByUser: {
            ...get().triedByUser,
            [userId]: { ...(get().triedByUser[userId] ?? {}), [dishId]: facts },
          },
        }),
      forgetTriedDish: (userId, dishId) => {
        const current = { ...(get().triedByUser[userId] ?? {}) };
        delete current[dishId];
        set({ triedByUser: { ...get().triedByUser, [userId]: current } });
      },
    }),
    {
      name: "hungry-achievement-tally-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ triedByUser: state.triedByUser }),
    },
  ),
);
