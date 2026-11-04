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
import { reportError } from "@/lib/monitoring/reportError";
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
  /**
   * Rolls the optimistic write back and rethrows when the save is not stored. Points for the
   * save are awarded in the background: a points failure is reported, never thrown.
   */
  toggleSaved: (userId: string, stallId: string) => Promise<void>;
  /**
   * Toggle `isTried` for a stall.
   * Returns the post-toggle state and how many Food Cred points were awarded.
   *
   * Marking a stall visited is one tap and never needs a review. Points for it need one:
   * the server pays `stall_marked_tried` only once the diner has reviewed a dish at the
   * stall. `skipPoints` leaves the request out when the caller knows there is no review.
   */
  markTried: (
    userId: string,
    stallId: string,
    sourceScreen?: StallInteractionSourceScreen,
    options?: { skipPoints?: boolean },
  ) => Promise<{
    isTried: boolean;
    pointsAwarded: number;
  }>;
  /**
   * A review was just posted for a dish at this stall: if the diner had already marked the
   * stall visited, the visit's points are due now. The server pays once per stall.
   */
  awardVisitAfterReview: (userId: string, stallId: string) => Promise<void>;
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

    let remoteUpdated: StallInteraction | null | undefined;
    try {
      remoteUpdated = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
        isSaved: !wasSaved,
      });
    } catch (error) {
      // Nothing was stored: put the button back instead of showing a state that is not real.
      rollbackInteraction(stallId, updated, existing);
      throw error;
    }
    if (remoteUpdated) {
      set((state) => ({
        interactions: { ...state.interactions, [stallId]: remoteUpdated },
      }));
    }

    if (!wasSaved) {
      // The save is stored: count it before the extras, which must never fail the save.
      trackStallSaved({ stallId, sourceScreen: "StallDetail" });
      // Rate-limit: today's saves before this one (the new row is already in the map).
      const todaySaveCount =
        Object.values(get().interactions).filter(
          (i) => i.isSaved && i.savedAt && isToday(i.savedAt),
        ).length - 1;
      if (withinCredCutoff("stall_saved", todaySaveCount)) {
        void useFoodCredStore
          .getState()
          .awardPoints("stall_saved", stallId)
          .catch((error) =>
            reportError(error, { store: "stallInteraction", action: "award_stall_saved" }),
          );
      }
    }
  },

  markTried: async (userId, stallId, sourceScreen = "StallDetail", options) => {
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

    let remoteUpdated: StallInteraction | null | undefined;
    try {
      remoteUpdated = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
        isTried: !shouldUnmark,
      });
    } catch (error) {
      rollbackInteraction(stallId, updated, existing);
      throw error;
    }
    if (remoteUpdated) {
      set((state) => ({
        interactions: { ...state.interactions, [stallId]: remoteUpdated },
      }));
    }

    let pointsAwarded = 0;
    if (!shouldUnmark) {
      // Rate-limit: today's tried marks before this one (the new row is already in the map).
      const todayTriedCount =
        Object.values(get().interactions).filter(
          (i) => i.isTried && i.triedAt && isToday(i.triedAt),
        ).length - 1;
      // The mark is stored: count it before the points, which must never fail the mark.
      trackStallMarkedTried({ stallId, sourceScreen });
      if (!options?.skipPoints && withinCredCutoff("stall_marked_tried", todayTriedCount)) {
        // Report what was actually credited: the server can award 0 (daily cap, repeat).
        try {
          await useFoodCredStore.getState().awardPoints("stall_marked_tried", stallId);
          pointsAwarded = useFoodCredStore.getState().lastEarnedPoints;
        } catch (error) {
          reportError(error, { store: "stallInteraction", action: "award_stall_marked_tried" });
        }
      }
    }

    return {
      isTried: !shouldUnmark,
      pointsAwarded,
    };
  },

  awardVisitAfterReview: async (userId, stallId) => {
    try {
      // Reviewing from the composer, not the stall page: the visits may not be loaded yet.
      await get().loadInteractions(userId);
      if (!get().interactions[stallId]?.isTried) return;
      await useFoodCredStore.getState().awardPoints("stall_marked_tried", stallId);
    } catch (error) {
      // The review is posted; a points failure must never surface as a review failure.
      reportError(error, { store: "stallInteraction", action: "award_visit_after_review" });
    }
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

/** Restore the pre-tap state, unless something newer has replaced the optimistic write. */
function rollbackInteraction(
  stallId: string,
  optimistic: StallInteraction,
  previous: StallInteraction | undefined,
): void {
  if (useStallInteractionStore.getState().interactions[stallId] !== optimistic) return;
  useStallInteractionStore.setState((state) => {
    const next = { ...state.interactions };
    if (previous) next[stallId] = previous;
    else delete next[stallId];
    return { interactions: next };
  });
}

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
