import { create } from "zustand";

import type { SavedSection } from "@/features/saved/savedDishes";

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
 * Where the diner left the Saved page (section, Want to try / Tried, List / Map), so coming back
 * from a dish page or another tab lands in the same place. Kept for the session, not on disk:
 * a fresh launch opens on Dishes.
 */
export const useSavedViewStore = create<SavedViewState>((set) => ({
  ...INITIAL,
  setSection: (section) => set({ section }),
  setTab: (tab) => set({ tab }),
  setMode: (mode) => set({ mode }),
  reset: () => set({ ...INITIAL }),
}));
