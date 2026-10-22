import { getAccountGeneration } from "@/lib/security/accountScope";
/**
 * useFoodCredStore — Food Cred contribution score system
 *
 * Replaces the old useGamificationStore (which used childish naming).
 * This store manages the user's Food Cred total, level tier, and
 * the last earned amount (used to drive reward animations).
 *
 * Repository-backed: mock mode keeps local demo state, while Supabase mode
 * hydrates `user_food_cred` and writes awards through `award_food_cred`.
 */

import { create } from "zustand";
import { getDataRepository, getServiceProvider } from "@/lib/services/serviceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  FOOD_CRED_LEVELS,
  FOOD_CRED_POINTS,
  resolveFoodCredLevel,
  resolveLevelProgress,
} from "@/constants/foodCredConfig";
import type { FoodCredAction, FoodCredLevel } from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

let storeEpoch = 0;
const accountStamp = () => `${getAccountGeneration()}:${storeEpoch}`;

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
   * Uses the active repository first; falls back to local demo math in mock/offline mode.
   */
  awardPoints: (action: FoodCredAction, relatedEntityId?: string) => Promise<number>;
  /**
   * Adjust Food Cred by an explicit signed delta.
   * Used for reversals such as unmarking a tried action.
   */
  adjustPoints: (
    delta: number,
    relatedEntityId?: string,
    action?: FoodCredAction,
  ) => Promise<number>;
  /** Reset — dev/test only */
  _reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MOCK_INITIAL_POINTS = 150; // starts demo user at "Regular" tier

function relatedEntityTypeForAction(
  action: FoodCredAction,
): "stall" | "review" | "post" | "collection" | "mission" | undefined {
  if (
    action === "stall_saved" ||
    action === "stall_marked_tried" ||
    action === "stall_submitted" ||
    action === "stall_info_corrected"
  ) {
    return "stall";
  }
  if (action === "review_created" || action === "helpful_vote_received") return "review";
  if (action === "post_created" || action === "photo_uploaded" || action === "tag_added")
    return "post";
  if (action === "collection_created") return "collection";
  if (action === "mission_completed") return "mission";
  return undefined;
}

export const useFoodCredStore = create<FoodCredState>()((set, get) => ({
  totalPoints: MOCK_INITIAL_POINTS,
  levelIndex: 1, // "Regular"
  lastEarnedPoints: 0,
  isLoaded: false,

  currentLevel: () => resolveFoodCredLevel(get().totalPoints),
  levelProgress: () => resolveLevelProgress(get().totalPoints),

  loadCredProfile: async (userId) => {
    const stamp = accountStamp();
    if (get().isLoaded) return;

    // Active repository handles mock or Supabase `user_food_cred` hydration.
    const repo = getDataRepository();
    const cred = (await repo.getUserFoodCred?.(userId)) ?? null;

    if (stamp !== accountStamp()) return;
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
    const stamp = accountStamp();
    const repo = getDataRepository();
    const remoteCred = await repo.awardFoodCred?.(
      action,
      relatedEntityId,
      relatedEntityTypeForAction(action),
    );
    if (stamp !== accountStamp()) throw new Error("Your account changed.");
    if (remoteCred) {
      set({
        totalPoints: remoteCred.totalPoints,
        levelIndex: remoteCred.levelIndex,
        lastEarnedPoints: remoteCred.pointsAwarded,
      });

      trackAnalyticsEvent("food_cred_earned", {
        amount: remoteCred.pointsAwarded,
        source_action: action,
        new_total: remoteCred.totalPoints,
        new_level: resolveFoodCredLevel(remoteCred.totalPoints).name,
        related_entity_id: relatedEntityId,
      });

      return remoteCred.totalPoints;
    }

    if (getServiceProvider().mode !== "mock")
      throw new Error("Reward could not be confirmed. Refresh your Food Cred.");
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

    return newTotal;
  },

  adjustPoints: async (delta, relatedEntityId, action) => {
    if (delta === 0) return get().totalPoints;

    const prevTotal = get().totalPoints;
    const newTotal = Math.max(0, prevTotal + delta);
    const newLevel = resolveFoodCredLevel(newTotal);
    const prevLevel = resolveFoodCredLevel(prevTotal);

    set({
      totalPoints: newTotal,
      levelIndex: newLevel.index,
      lastEarnedPoints: Math.max(0, delta),
    });

    trackAnalyticsEvent("food_cred_adjusted", {
      action: action ?? "stall_marked_tried",
      delta,
      source_action: action,
      new_total: newTotal,
      new_level: newLevel.name,
      related_entity_id: relatedEntityId,
      previous_level: prevLevel.name,
    });

    if (newLevel.index !== prevLevel.index) {
      trackAnalyticsEvent("food_cred_level_changed", {
        old_level: prevLevel.name,
        new_level: newLevel.name,
        total_points: newTotal,
      });
    }

    return newTotal;
  },

  _reset: () => {
    storeEpoch++;
    set({ totalPoints: 0, levelIndex: 0, lastEarnedPoints: 0, isLoaded: false });
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** All level tiers — useful for progress display UIs */
export { FOOD_CRED_LEVELS };
