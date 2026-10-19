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
import { persist } from "zustand/middleware";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { hungryPersistStorage } from "@/store/persistStorage";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
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
  PassportContributionStats,
  PassportNextStamp,
  PassportProgressEvent,
  PassportStamp,
  UserPassportProgress,
} from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface PassportState {
  /** Map of categoryId → computed progress */
  progressMap: Record<string, UserPassportProgress>;
  celebratedStampIds: Record<string, boolean>;
  /** Stamps already reported as passport_stamp_earned, so a cold start does not re-emit them. */
  reportedEarnedStampIds: Record<string, boolean>;
  /** User the persisted celebrated/reported ids belong to. */
  ownerUserId: string | null;
  isComputed: boolean;

  /** Database-backed stamps (new gamification features) */
  stamps: PassportStamp[];
  events: PassportProgressEvent[];
  isLoaded: boolean;

  // Queries
  getProgress: (categoryId: string) => UserPassportProgress | null;
  /** Returns categories with at least 1 stamp earned */
  getEarnedCategories: () => UserPassportProgress[];
  getEarnedStamps: () => EarnedPassportStamp[];
  getNextStamp: () => PassportNextStamp | null;
  getNewlyEarnedUncelebratedStamp: () => EarnedPassportStamp | null;
  getCelebrateMarker: () => PassportCelebrateMarker | null;
  getPortfolioContributionStats: () => PassportContributionStats;

  // Actions
  /**
   * Re-compute passport progress from current tried stall set.
   * Call after markTried() or on screen focus.
   */
  computeProgress: (triedStallIds: string[]) => void;
  markStampCelebrated: (stampId: string) => void;

  // Database-backed actions (new gamification features)
  loadStamps: () => Promise<void>;
  loadEvents: (categoryId?: string) => Promise<void>;
  recordContribution: (
    userId: string,
    eventType: PassportProgressEvent["eventType"],
    referenceId?: string,
  ) => Promise<void>;

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

function countUniqueContributionEvents(
  events: PassportProgressEvent[],
  eventType: PassportProgressEvent["eventType"],
): number {
  return new Set(
    events
      .filter((event) => event.eventType === eventType)
      .map((event) => event.referenceId ?? event.id),
  ).size;
}

function buildContributionStats(
  stamps: PassportStamp[],
  events: PassportProgressEvent[],
): PassportContributionStats {
  const stampTotals = stamps.reduce(
    (totals, stamp) => ({
      stallsSubmitted: totals.stallsSubmitted + stamp.stallsSubmittedCount,
      portfolioItemsAdded: totals.portfolioItemsAdded + stamp.portfolioItemsAdded,
      publicPortfoliosPublished: totals.publicPortfoliosPublished + stamp.publicPortfoliosPublished,
      trailsCompleted: totals.trailsCompleted + stamp.trailsCompleted,
    }),
    {
      stallsSubmitted: 0,
      portfolioItemsAdded: 0,
      publicPortfoliosPublished: 0,
      trailsCompleted: 0,
    },
  );

  const recentEvents = events
    .filter((event) =>
      [
        "stall_submitted",
        "portfolio_item_added",
        "public_portfolio_published",
        "trail_completed",
      ].includes(event.eventType),
    )
    .slice(0, 4);

  return {
    stallsSubmitted: Math.max(
      stampTotals.stallsSubmitted,
      countUniqueContributionEvents(events, "stall_submitted"),
    ),
    portfolioItemsAdded: Math.max(
      stampTotals.portfolioItemsAdded,
      countUniqueContributionEvents(events, "portfolio_item_added"),
    ),
    publicPortfoliosPublished: Math.max(
      stampTotals.publicPortfoliosPublished,
      countUniqueContributionEvents(events, "public_portfolio_published"),
    ),
    trailsCompleted: Math.max(
      stampTotals.trailsCompleted,
      countUniqueContributionEvents(events, "trail_completed"),
    ),
    recentEvents,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function getCurrentProfileId(): string | null {
  const { useProfileStore } = require("./useProfileStore") as typeof import("./useProfileStore");
  return useProfileStore.getState().profile?.id ?? null;
}

export const usePassportStore = create<PassportState>()(
  persist(
    (set, get) => {
      /** Persisted ids are per user: switch accounts and they start empty. */
      const ensureOwner = () => {
        const userId = getCurrentProfileId();
        if (get().ownerUserId === userId) return;
        set({ ownerUserId: userId, celebratedStampIds: {}, reportedEarnedStampIds: {} });
      };
      /** Latest input queued before the persisted ids finished loading. */
      let pendingTriedStallIds: string[] | null = null;

      return {
        progressMap: {},
        celebratedStampIds: {},
        reportedEarnedStampIds: {},
        ownerUserId: null,
        isComputed: false,
        stamps: [],
        events: [],
        isLoaded: false,

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

        getPortfolioContributionStats: () => buildContributionStats(get().stamps, get().events),

        computeProgress: (triedStallIds) => {
          // Until the persisted reported ids load, every stamp looks new and would re-fire
          // passport_stamp_earned on cold start; run once hydration finishes instead.
          if (!usePassportStore.persist.hasHydrated()) {
            if (pendingTriedStallIds === null) {
              usePassportStore.persist.onFinishHydration(() => {
                const queued = pendingTriedStallIds;
                pendingTriedStallIds = null;
                if (queued) get().computeProgress(queued);
              });
            }
            pendingTriedStallIds = triedStallIds;
            return;
          }
          ensureOwner();
          const previousEarnedIds = new Set([
            ...getEarnedPassportStamps(get().progressMap).map((stamp) => stamp.id),
            ...Object.keys(get().reportedEarnedStampIds),
          ]);
          const stallSet = new Set(triedStallIds);
          const newMap: Record<string, UserPassportProgress> = {};

          for (const category of ALL_PASSPORT_CATEGORIES) {
            const matchCount = countMatchingTriedStalls(stallSet, category.matchTag);
            newMap[category.id] = computePassportProgress(category, matchCount);
          }

          const newlyEarned = getEarnedPassportStamps(newMap).filter(
            (stamp) => !previousEarnedIds.has(stamp.id),
          );
          set((state) => ({
            progressMap: newMap,
            isComputed: true,
            reportedEarnedStampIds: newlyEarned.length
              ? {
                  ...state.reportedEarnedStampIds,
                  ...Object.fromEntries(newlyEarned.map((stamp) => [stamp.id, true])),
                }
              : state.reportedEarnedStampIds,
          }));
          for (const stamp of newlyEarned) {
            trackAnalyticsEvent("passport_stamp_earned", {
              stamp_id: stamp.id,
              category_id: stamp.categoryId,
              threshold: stamp.threshold,
            });
          }
        },

        markStampCelebrated: (stampId) => {
          ensureOwner();
          set((state) => ({
            celebratedStampIds: {
              ...state.celebratedStampIds,
              [stampId]: true,
            },
          }));
        },

        loadStamps: async () => {
          const service = getHungryService();
          const stamps = await service.passport.getPassportStamps();
          set({ stamps, isLoaded: true });
        },

        loadEvents: async (categoryId?: string) => {
          const service = getHungryService();
          const events = await service.passport.getPassportProgressEvents(categoryId);
          set({ events });
        },

        recordContribution: async (_userId, eventType, referenceId) => {
          const service = getHungryService();
          await service.passport.recordProgress("contributor", eventType, referenceId);
          const [stamps, events] = await Promise.all([
            service.passport.getPassportStamps(),
            service.passport.getPassportProgressEvents("contributor"),
          ]);
          set({ stamps, events, isLoaded: true });
        },

        _reset: () =>
          set({
            progressMap: {},
            celebratedStampIds: {},
            reportedEarnedStampIds: {},
            ownerUserId: null,
            isComputed: false,
            stamps: [],
            events: [],
            isLoaded: false,
          }),
      };
    },
    {
      name: "passport-celebrations-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        celebratedStampIds: state.celebratedStampIds,
        reportedEarnedStampIds: state.reportedEarnedStampIds,
        ownerUserId: state.ownerUserId,
      }),
    },
  ),
);

/** All passport category configs — for display in the Passport screen */
export { ALL_PASSPORT_CATEGORIES };
