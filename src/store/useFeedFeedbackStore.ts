import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  activeMutedFoodTypes,
  MUTE_FOOD_TYPE_MS,
  SESSION_ACTION_LIMIT,
  type MutedFoodType,
  type SessionAction,
  type SessionActionKind,
} from "@/features/discover/personalFeedback";
import { hungryPersistStorage } from "./persistStorage";

type FeedFeedbackState = {
  /** Food types the diner asked to see less of (kept on the device for 30 days). */
  mutedFoodTypes: MutedFoodType[];
  /** What the diner did on Home in this app session. Never saved, so a new launch starts fresh. */
  sessionActions: SessionAction[];
  /** Popular dishes the diner pinned to Home, in the order they chose. */
  favouriteFoodStyleIds: string[];
  recordSessionAction: (dishId: string, kind: SessionActionKind, now?: number) => void;
  muteFoodType: (foodType: string, now?: number) => void;
  /** Pins a popular dish to Home (at the end), or unpins it when it is already pinned. */
  toggleFavouriteFoodStyle: (id: string) => void;
  /** Moves a pinned popular dish one place earlier (-1) or later (1). */
  moveFavouriteFoodStyle: (id: string, direction: -1 | 1) => void;
  _reset: () => void;
};

/**
 * Home feedback that is not a taste signal by itself: "Show less of this food", the dishes
 * touched in this visit, and the popular dishes pinned to Home. "Not for me" on a dish goes through the profile store's food history
 * instead, so it also reaches the server.
 */
export const useFeedFeedbackStore = create<FeedFeedbackState>()(
  persist(
    (set) => ({
      mutedFoodTypes: [],
      sessionActions: [],
      recordSessionAction: (dishId, kind, now = Date.now()) =>
        set((state) => ({
          sessionActions: [...state.sessionActions, { dishId, kind, at: now }].slice(
            -SESSION_ACTION_LIMIT,
          ),
        })),
      muteFoodType: (foodType, now = Date.now()) => {
        const normalized = foodType.trim().toLowerCase();
        if (!normalized) return;
        set((state) => ({
          mutedFoodTypes: [
            ...activeMutedFoodTypes(state.mutedFoodTypes, now).filter(
              (item) => item.foodType !== normalized,
            ),
            { foodType: normalized, until: now + MUTE_FOOD_TYPE_MS },
          ],
        }));
      },
      favouriteFoodStyleIds: [],
      toggleFavouriteFoodStyle: (id) =>
        set((state) => ({
          favouriteFoodStyleIds: state.favouriteFoodStyleIds.includes(id)
            ? state.favouriteFoodStyleIds.filter((item) => item !== id)
            : [...state.favouriteFoodStyleIds, id],
        })),
      moveFavouriteFoodStyle: (id, direction) =>
        set((state) => {
          const from = state.favouriteFoodStyleIds.indexOf(id);
          const to = from + direction;
          if (from < 0 || to < 0 || to >= state.favouriteFoodStyleIds.length) return state;
          const next = [...state.favouriteFoodStyleIds];
          [next[from], next[to]] = [next[to], next[from]];
          return { favouriteFoodStyleIds: next };
        }),
      _reset: () => set({ mutedFoodTypes: [], sessionActions: [], favouriteFoodStyleIds: [] }),
    }),
    {
      name: "hungry-feed-feedback-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        mutedFoodTypes: state.mutedFoodTypes,
        favouriteFoodStyleIds: state.favouriteFoodStyleIds,
      }),
    },
  ),
);
