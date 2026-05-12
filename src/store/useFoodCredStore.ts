/**
 * useFoodCredStore — Food Cred contribution score system
 *
 * Replaces the old useGamificationStore (which used childish naming).
 * This store manages the user's Food Cred total, level tier, and
 * the last earned amount (used to drive reward animations).
 *
 * Production swap plan:
 *   1. Replace `loadCredProfile()` body with Supabase query on `user_food_cred`.
 *   2. Replace `_awardPoints()` body with RPC call to `award_food_cred`.
 *   3. Call `loadCredProfile()` inside `useAppBootstrap` after session hydration.
 */

import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  FOOD_CRED_LEVELS,
  FOOD_CRED_POINTS,
  resolveFoodCredLevel,
  resolveLevelProgress,
} from "@/constants/foodCredConfig";
import type { FoodCredAction, FoodCredLevel } from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface FoodCredState {
  totalPoints: number;
  levelIndex: number;
  /** Points earned in the most recent action — drives the reward toast animation */
  lastEarnedPoints: number;
  isLoaded: boolean;

  // Derived (computed — not stored in persist)
  currentLevel: () => FoodCredLevel;
  levelProgress: () => number;

  // Actions
  /** Hydrate from storage or remote. No-op if already loaded. */
  loadCredProfile: (userId: string) => Promise<void>;
  /**
   * Award Food Cred for a qualifying action.
   * Mock: updates in-memory total.
   * Production: replace with RPC call to award_food_cred.
   */
  awardPoints: (action: FoodCredAction, relatedEntityId?: string) => Promise<number>;
  /** Reset — dev/test only */
  _reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MOCK_INITIAL_POINTS = 150; // starts demo user at "Regular" tier

export const useFoodCredStore = create<FoodCredState>()((set, get) => ({
  totalPoints: MOCK_INITIAL_POINTS,
  levelIndex: 1, // "Regular"
  lastEarnedPoints: 0,
  isLoaded: false,

  currentLevel: () => resolveFoodCredLevel(get().totalPoints),
  levelProgress: () => resolveLevelProgress(get().totalPoints),

  loadCredProfile: async (userId) => {
    if (get().isLoaded) return;

    // Mock phase: load from mock repository
    // Production swap: replace with Supabase query on user_food_cred
    const repo = getDataRepository();
    const cred = (await repo.getUserFoodCred?.(userId)) ?? null;

    if (cred) {
      set({
        totalPoints: cred.totalPoints,
        levelIndex: cred.levelIndex,
        isLoaded: true,
      });
    } else {
      set({ isLoaded: true });
    }
  },

  awardPoints: async (action, relatedEntityId) => {
    const earned = FOOD_CRED_POINTS[action] ?? 0;
    if (earned === 0) return get().totalPoints;

    const prevTotal = get().totalPoints;
    const newTotal = prevTotal + earned;
    const newLevel = resolveFoodCredLevel(newTotal);
    const prevLevel = resolveFoodCredLevel(prevTotal);

    set({
      totalPoints: newTotal,
      levelIndex: newLevel.index,
      lastEarnedPoints: earned,
    });

    // Analytics
    trackAnalyticsEvent("food_cred_earned", {
      amount: earned,
      source_action: action,
      new_total: newTotal,
      new_level: newLevel.name,
      related_entity_id: relatedEntityId,
    });

    if (newLevel.index > prevLevel.index) {
      trackAnalyticsEvent("food_cred_level_changed", {
        old_level: prevLevel.name,
        new_level: newLevel.name,
        total_points: newTotal,
      });
    }

    // TODO (production): call supabase.rpc('award_food_cred', { p_source_action: action, p_points: earned })

    return newTotal;
  },

  _reset: () => set({ totalPoints: 0, levelIndex: 0, lastEarnedPoints: 0, isLoaded: false }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** All level tiers — useful for progress display UIs */
export { FOOD_CRED_LEVELS };
