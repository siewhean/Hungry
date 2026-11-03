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
  recordSessionAction: (dishId: string, kind: SessionActionKind, now?: number) => void;
  muteFoodType: (foodType: string, now?: number) => void;
  _reset: () => void;
};

/**
 * Home feedback that is not a taste signal by itself: "Show less of this food" and the dishes
 * touched in this visit. "Not for me" on a dish goes through the profile store's food history
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
      _reset: () => set({ mutedFoodTypes: [], sessionActions: [] }),
    }),
    {
      name: "hungry-feed-feedback-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ mutedFoodTypes: state.mutedFoodTypes }),
    },
  ),
);
