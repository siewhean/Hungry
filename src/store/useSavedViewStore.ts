import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SavedSection } from "@/features/saved/savedDishes";
import { hungryPersistStorage } from "./persistStorage";

export type SavedDishTab = "want" | "tried";
export type SavedViewMode = "list" | "map";

type SavedViewState = {
  section: SavedSection;
  tab: SavedDishTab;
  mode: SavedViewMode;
  setSection: (section: SavedSection) => void;
  setTab: (tab: SavedDishTab) => void;
  setMode: (mode: SavedViewMode) => void;
  reset: () => void;
};

const INITIAL = { section: "dishes", tab: "want", mode: "list" } as const;

/**
 * Where the diner left the Saved page, so coming back lands in the same place. The section
 * (Dishes, Stalls, Lists) is kept on the device across launches; Want to try / Tried and
 * List / Map are kept for the session only, so a fresh launch opens on the list of dishes.
 */
export const useSavedViewStore = create<SavedViewState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setSection: (section) => set({ section }),
      setTab: (tab) => set({ tab }),
      setMode: (mode) => set({ mode }),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "hungry-saved-view-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ section: state.section }),
    },
  ),
);
