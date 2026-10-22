import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

/** The week's picks as first computed: dish ids and their one-line reasons. */
export interface StoredWeeklyPicks {
  /** Account, ISO week and dietary filters. A new key means the picks are recomputed. */
  key: string;
  personalised: boolean;
  picks: { dishId: string; explanation: string }[];
}

interface WeeklyPicksState {
  stored: StoredWeeklyPicks | null;
  save: (stored: StoredWeeklyPicks) => void;
  clear: () => void;
}

/**
 * "New picks every Monday" must hold between Mondays: a like or save changes the taste
 * vector, so the picks are kept for the week instead of being re-ranked on every change.
 */
export const useWeeklyPicksStore = create<WeeklyPicksState>()(
  persist(
    (set) => ({
      stored: null,
      save: (stored) => set({ stored }),
      clear: () => set({ stored: null }),
    }),
    { name: "hungry-weekly-picks-v1", storage: hungryPersistStorage },
  ),
);
