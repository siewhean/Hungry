import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ACHIEVEMENT_BUDGET_PRICE,
  ACHIEVEMENT_TASTE_THRESHOLD,
} from "@/features/achievements/achievements";
import type { DishDetail } from "@/types/domain";

import { hungryPersistStorage } from "./persistStorage";

/** What an achievement needs to know about a tried dish, kept so it is counted once. */
export type TriedDishFacts = { spicy: boolean; sweet: boolean; budget: boolean };

/** Reads the achievement facts from a dish; an untagged dish never counts as spicy or sweet. */
export function triedDishFacts(
  dish: Pick<DishDetail, "tasteVector" | "price" | "tasteConfidence">,
  hasTasteSignal: boolean,
): TriedDishFacts {
  return {
    spicy: hasTasteSignal && (dish.tasteVector.spicy ?? 0) >= ACHIEVEMENT_TASTE_THRESHOLD,
    sweet: hasTasteSignal && (dish.tasteVector.sweet ?? 0) >= ACHIEVEMENT_TASTE_THRESHOLD,
    budget: dish.price > 0 && dish.price <= ACHIEVEMENT_BUDGET_PRICE,
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
