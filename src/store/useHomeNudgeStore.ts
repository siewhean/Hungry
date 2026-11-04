import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

/** How long "Not now" on a Home nudge keeps it away. */
export const HOME_NUDGE_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

interface HomeNudgeState {
  /** When the diner last said "Not now" to the meal-picks card. Device-level. */
  mealPicksSnoozedAt: number | null;
  snoozeMealPicks: (now?: number) => void;
  /** True while the meal-picks card is snoozed. */
  isMealPicksSnoozed: (now?: number) => boolean;
}

/** Device-level memory for Home's one-off nudges, so a "Not now" is not asked again tomorrow. */
export const useHomeNudgeStore = create<HomeNudgeState>()(
  persist(
    (set, get) => ({
      mealPicksSnoozedAt: null,
      snoozeMealPicks: (now = Date.now()) => set({ mealPicksSnoozedAt: now }),
      isMealPicksSnoozed: (now = Date.now()) => {
        const at = get().mealPicksSnoozedAt;
        return at !== null && now - at < HOME_NUDGE_SNOOZE_MS;
      },
    }),
    {
      name: "hungry-home-nudges-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ mealPicksSnoozedAt: state.mealPicksSnoozedAt }),
    },
  ),
);
