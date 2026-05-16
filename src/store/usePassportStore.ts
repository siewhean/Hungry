/**
 * usePassportStore — Hungry Passport progress per user
 *
 * Computes passport progress by joining:
 *   - `useStallInteractionStore.getTriedStallIds()` (which stalls the user tried)
 *   - `ALL_PASSPORT_CATEGORIES` config (which cuisine/neighbourhood tags to match)
 *   - Venue metadata (cuisineTags, neighbourhood) from the repository
 *
 * MVP: progress is computed client-side on demand (no separate DB table).
 *
 * Production swap:
 *   1. Add a `passport_stamps` table in Supabase to cache computed stamps.
 *   2. Replace `computeProgress()` body with a Supabase RPC call.
 */

import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import {
  ALL_PASSPORT_CATEGORIES,
  computePassportProgress,
  createPassportCelebrateMarker,
  getEarnedPassportStamps,
  getNewlyEarnedUncelebratedStamp,
  getNextPassportStamp,
} from "@/constants/passportConfig";
import type {
  EarnedPassportStamp,
  PassportCelebrateMarker,
  PassportNextStamp,
  UserPassportProgress,
} from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface PassportState {
  /** Map of categoryId → computed progress */
  progressMap: Record<string, UserPassportProgress>;
  celebratedStampIds: Record<string, boolean>;
  isComputed: boolean;

  // Queries
  getProgress: (categoryId: string) => UserPassportProgress | null;
  /** Returns categories with at least 1 stamp earned */
  getEarnedCategories: () => UserPassportProgress[];
  getEarnedStamps: () => EarnedPassportStamp[];
  getNextStamp: () => PassportNextStamp | null;
  getNewlyEarnedUncelebratedStamp: () => EarnedPassportStamp | null;
  getCelebrateMarker: () => PassportCelebrateMarker | null;

  // Actions
  /**
   * Re-compute passport progress from current tried stall set.
   * Call after markTried() or on screen focus.
   */
  computeProgress: (triedStallIds: string[]) => void;
  markStampCelebrated: (stampId: string) => void;
  _reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Matches tried stall IDs against a passport category's `matchTag`.
 * Checks the `tasteTags` of dishes at each tried stall.
 * A stall counts if any of its dishes contain the matchTag.
 */
function countMatchingTriedStalls(triedStallIds: Set<string>, matchTag: string): number {
  const repo = getDataRepository();
  const tag = matchTag.toLowerCase();
  let count = 0;
  for (const stallId of triedStallIds) {
    const dishes = repo.listDishesByVenue(stallId);
    const matches = dishes.some((dish) =>
      (dish.tasteTags ?? []).some((t: string) => t.toLowerCase().includes(tag)),
    );
    if (matches) count++;
  }
  return count;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePassportStore = create<PassportState>()((set, get) => ({
  progressMap: {},
  celebratedStampIds: {},
  isComputed: false,

  getProgress: (categoryId) => get().progressMap[categoryId] ?? null,

  getEarnedCategories: () =>
    Object.values(get().progressMap).filter((p) => p.earnedStampThresholds.length > 0),

  getEarnedStamps: () => getEarnedPassportStamps(get().progressMap),

  getNextStamp: () => getNextPassportStamp(get().progressMap),

  getNewlyEarnedUncelebratedStamp: () =>
    getNewlyEarnedUncelebratedStamp(get().progressMap, get().celebratedStampIds),

  getCelebrateMarker: () =>
    createPassportCelebrateMarker(
      getNewlyEarnedUncelebratedStamp(get().progressMap, get().celebratedStampIds),
    ),

  computeProgress: (triedStallIds) => {
    const stallSet = new Set(triedStallIds);
    const newMap: Record<string, UserPassportProgress> = {};

    for (const category of ALL_PASSPORT_CATEGORIES) {
      const matchCount = countMatchingTriedStalls(stallSet, category.matchTag);
      newMap[category.id] = computePassportProgress(category, matchCount);
    }

    set({ progressMap: newMap, isComputed: true });
  },

  markStampCelebrated: (stampId) =>
    set((state) => ({
      celebratedStampIds: {
        ...state.celebratedStampIds,
        [stampId]: true,
      },
    })),

  _reset: () => set({ progressMap: {}, celebratedStampIds: {}, isComputed: false }),
}));

/** All passport category configs — for display in the Passport screen */
export { ALL_PASSPORT_CATEGORIES };
