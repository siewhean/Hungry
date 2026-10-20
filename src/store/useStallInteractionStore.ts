/**
 * useStallInteractionStore — per-user save/tried/reviewed state for stalls
 *
 * Tracks whether the current user has saved, tried, or reviewed each stall.
 * This is the prerequisite for passport progress computation.
 *
 * Repository-backed: mock mode keeps local demo state, while Supabase mode
 * hydrates and upserts `user_stall_interactions`.
 */

import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useFoodCredStore } from "./useFoodCredStore";
import {
  trackStallSaved,
  trackStallMarkedTried,
  type StallInteractionSourceScreen,
} from "@/lib/analytics/gamificationEvents";
import { withinCredCutoff } from "@/constants/gamificationLimits";
import type { StallInteraction } from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface StallInteractionState {
  /** Map of stallId → interaction state */
  interactions: Record<string, StallInteraction>;
  isLoaded: boolean;

  // Queries
  getInteraction: (stallId: string) => StallInteraction | null;
  getSavedStallIds: () => string[];
  getTriedStallIds: () => string[];

  // Actions
  loadInteractions: (userId: string) => Promise<void>;
  toggleSaved: (userId: string, stallId: string) => Promise<void>;
  /**
   * Toggle `isTried` for a stall.
   * Returns the post-toggle state and how many Food Cred points were awarded.
   */
  markTried: (
    userId: string,
    stallId: string,
    sourceScreen?: StallInteractionSourceScreen,
  ) => Promise<{
    isTried: boolean;
    pointsAwarded: number;
  }>;
  markReviewed: (userId: string, stallId: string) => Promise<void>;
  /** Reset — dev/test only */
  _reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStallInteractionStore = create<StallInteractionState>()((set, get) => ({
  interactions: {},
  isLoaded: false,

  getInteraction: (stallId) => get().interactions[stallId] ?? null,

  getSavedStallIds: () =>
    Object.values(get().interactions)
      .filter((i) => i.isSaved)
      .map((i) => i.stallId),

  getTriedStallIds: () =>
    Object.values(get().interactions)
      .filter((i) => i.isTried)
      .map((i) => i.stallId),

  loadInteractions: async (userId) => {
    if (get().isLoaded) return;

    // Active repository handles mock or Supabase `user_stall_interactions` hydration.
    const repo = getDataRepository();
    const list: StallInteraction[] = (await repo.listStallInteractions?.(userId)) ?? [];

    const map: Record<string, StallInteraction> = {};
    for (const item of list) {
      map[item.stallId] = item;
    }

    set({ interactions: map, isLoaded: true });
  },

  toggleSaved: async (userId, stallId) => {
    const existing = get().interactions[stallId];
    const wasSaved = existing?.isSaved ?? false;
    const now = new Date().toISOString();

    const updated: StallInteraction = {
      userId,
      stallId,
      isSaved: !wasSaved,
      isTried: existing?.isTried ?? false,
      isReviewed: existing?.isReviewed ?? false,
      savedAt: !wasSaved ? now : existing?.savedAt,
      triedAt: existing?.triedAt,
      reviewedAt: existing?.reviewedAt,
    };

    set((state) => ({
      interactions: { ...state.interactions, [stallId]: updated },
    }));

    const remoteUpdated = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
      isSaved: !wasSaved,
    });
    if (remoteUpdated) {
      set((state) => ({
        interactions: { ...state.interactions, [stallId]: remoteUpdated },
      }));
    }

    if (!wasSaved) {
      // Rate-limit: count today's saves
      const todaySaveCount = Object.values(get().interactions).filter(
        (i) => i.isSaved && i.savedAt && isToday(i.savedAt),
      ).length;
      if (withinCredCutoff("stall_saved", todaySaveCount)) {
        await useFoodCredStore.getState().awardPoints("stall_saved", stallId);
      }
    }

    if (!wasSaved) {
      trackStallSaved({ stallId, sourceScreen: "StallDetail" });
    }
  },

  markTried: async (userId, stallId, sourceScreen = "StallDetail") => {
    const existing = get().interactions[stallId];
    const shouldUnmark = existing?.isTried ?? false;
    const now = new Date().toISOString();

    const updated: StallInteraction = {
      userId,
      stallId,
      isSaved: existing?.isSaved ?? false,
      isTried: !shouldUnmark,
      isReviewed: existing?.isReviewed ?? false,
      savedAt: existing?.savedAt,
      triedAt: shouldUnmark ? undefined : now,
      reviewedAt: existing?.reviewedAt,
    };

    set((state) => ({
      interactions: { ...state.interactions, [stallId]: updated },
    }));

    const remoteUpdated = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
      isTried: !shouldUnmark,
    });
    if (remoteUpdated) {
      set((state) => ({
        interactions: { ...state.interactions, [stallId]: remoteUpdated },
      }));
    }

    let pointsAwarded = 0;
    if (!shouldUnmark) {
      // Rate-limit: count today's tried marks
      const todayTriedCount = Object.values(get().interactions).filter(
        (i) => i.isTried && i.triedAt && isToday(i.triedAt),
      ).length;
      if (withinCredCutoff("stall_marked_tried", todayTriedCount)) {
        // Report what was actually credited: the server can award 0 (daily cap, repeat).
        await useFoodCredStore.getState().awardPoints("stall_marked_tried", stallId);
        pointsAwarded = useFoodCredStore.getState().lastEarnedPoints;
      }

      trackStallMarkedTried({ stallId, sourceScreen });
    }

    return {
      isTried: !shouldUnmark,
      pointsAwarded,
    };
  },

  markReviewed: async (userId, stallId) => {
    const existing = get().interactions[stallId];
    if (existing?.isReviewed) return; // idempotent
    const now = new Date().toISOString();

    const updated: StallInteraction = {
      userId,
      stallId,
      isSaved: existing?.isSaved ?? false,
      isTried: existing?.isTried ?? false,
      isReviewed: true,
      savedAt: existing?.savedAt,
      triedAt: existing?.triedAt,
      reviewedAt: now,
    };

    set((state) => ({
      interactions: { ...state.interactions, [stallId]: updated },
    }));

    const remoteUpdated = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
      isReviewed: true,
    });
    if (remoteUpdated) {
      set((state) => ({
        interactions: { ...state.interactions, [stallId]: remoteUpdated },
      }));
    }

    // Cred for review_created is awarded by the review flow, not here
  },

  _reset: () => set({ interactions: {}, isLoaded: false }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when an ISO timestamp falls within today (Singapore UTC+8). */
function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
