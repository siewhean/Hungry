/**
 * useStallInteractionStore — per-user save/tried/reviewed state for stalls
 *
 * Tracks whether the current user has saved, tried, or reviewed each stall.
 * This is the prerequisite for passport progress computation.
 *
 * Repository-backed: mock mode keeps local demo state, while Supabase mode
 * hydrates and upserts `user_stall_interactions`.
 */

import { getAccountGeneration, assertAccountGeneration } from "@/lib/security/accountScope";
import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { trackStallSaved, trackStallMarkedTried } from "@/lib/analytics/gamificationEvents";
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
  setVisited: (userId: string, stallId: string, desired: boolean) => Promise<boolean>;
  toggleSaved: (userId: string, stallId: string) => Promise<void>;
  /**
   * Toggle `isTried` for a stall.
   * Returns the post-toggle state and how many Food Cred points were awarded.
   */
  markTried: (
    userId: string,
    stallId: string,
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
    const generation = getAccountGeneration();
    const repo = getDataRepository();
    const list: StallInteraction[] = (await repo.listStallInteractions?.(userId)) ?? [];

    assertAccountGeneration(generation);
    const map: Record<string, StallInteraction> = {};
    for (const item of list) {
      map[item.stallId] = item;
    }

    set({ interactions: map, isLoaded: true });
  },

  toggleSaved: async (userId, stallId) => {
    const generation = getAccountGeneration();
    const current = get().interactions[stallId];
    const desired = !(current?.isSaved ?? false);
    const remote = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
      isSaved: desired,
    });
    assertAccountGeneration(generation);
    if (!remote) throw new Error("The save could not be confirmed. Try again.");
    set((state) => ({ interactions: { ...state.interactions, [stallId]: remote } }));
    if (desired) trackStallSaved({ stallId, sourceScreen: "StallDetail" });
  },
  setVisited: async (userId, stallId, desired) => {
    const generation = getAccountGeneration();
    const current = get().interactions[stallId];
    if (current?.userId === userId && current.isTried === desired) return desired;
    const remote = await getDataRepository().upsertStallInteraction?.(userId, stallId, {
      isTried: desired,
    });
    assertAccountGeneration(generation);
    if (!remote) throw new Error("Your visit could not be confirmed. Try again.");
    set((state) => ({ interactions: { ...state.interactions, [stallId]: remote } }));
    if (desired) trackStallMarkedTried({ stallId, sourceScreen: "StallDetail" });
    return remote.isTried;
  },
  markTried: async (userId, stallId) => ({
    isTried: await get().setVisited(
      userId,
      stallId,
      !(get().interactions[stallId]?.isTried ?? false),
    ),
    pointsAwarded: 0,
  }),

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
