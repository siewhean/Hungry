import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

interface WeeklyRecapState {
  /** The week (singaporeWeekIndex) whose recap the diner closed. */
  dismissedWeek: number | null;
  dismiss: (week: number) => void;
}

/** Remembers which Sunday recap was closed, so it does not come back that week. */
export const useWeeklyRecapStore = create<WeeklyRecapState>()(
  persist(
    (set) => ({
      dismissedWeek: null,
      dismiss: (week) => set({ dismissedWeek: week }),
    }),
    {
      name: "hungry-weekly-recap-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ dismissedWeek: state.dismissedWeek }),
    },
  ),
);
