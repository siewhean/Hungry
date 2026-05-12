/**
 * useStallInteractionStore — per-user save/tried/reviewed state for stalls
 *
 * Tracks whether the current user has saved, tried, or reviewed each stall.
 * This is the prerequisite for passport progress computation.
 *
 * Production swap plan:
 *   1. Replace `loadInteractions()` with Supabase query on `user_stall_interactions`.
 *   2. Replace `toggleSaved()` / `markTried()` with Supabase upserts.
 *   3. Award Food Cred by calling `useFoodCredStore.awardPoints()` after each mutation.
 */

import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useFoodCredStore } from "./useFoodCredStore";
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
  markTried: (userId: string, stallId: string) => Promise<void>;
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

    // Mock phase: load from repository
    // Production swap: Supabase query on user_stall_interactions WHERE user_id = userId
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

    if (!wasSaved) {
      // Award cred only when saving (not unsaving)
      await useFoodCredStore.getState().awardPoints("stall_saved", stallId);
    }

    trackAnalyticsEvent(wasSaved ? "stall_unsaved" : "stall_saved", {
      stall_id: stallId,
      source_screen: "stall_detail",
    });

    // TODO (production): supabase.from('user_stall_interactions').upsert({ user_id: userId, stall_id: stallId, is_saved: !wasSaved })
  },

  markTried: async (userId, stallId) => {
    const existing = get().interactions[stallId];
    if (existing?.isTried) return; // idempotent — don't re-award cred
    const now = new Date().toISOString();

    const updated: StallInteraction = {
      userId,
      stallId,
      isSaved: existing?.isSaved ?? false,
      isTried: true,
      isReviewed: existing?.isReviewed ?? false,
      savedAt: existing?.savedAt,
      triedAt: now,
      reviewedAt: existing?.reviewedAt,
    };

    set((state) => ({
      interactions: { ...state.interactions, [stallId]: updated },
    }));

    await useFoodCredStore.getState().awardPoints("stall_marked_tried", stallId);

    trackAnalyticsEvent("stall_marked_tried", {
      stall_id: stallId,
      source_screen: "stall_detail",
    });

    // TODO (production): supabase.from('user_stall_interactions').upsert({ ..., is_tried: true, tried_at: now })
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

    // Cred for review_created is awarded by the review flow, not here
    // TODO (production): upsert is_reviewed = true
  },

  _reset: () => set({ interactions: {}, isLoaded: false }),
}));
