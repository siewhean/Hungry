/**
 * useMomentStore — the stamp and achievement celebrations waiting to be shown.
 *
 * `queue` is in memory only. `levelsByUser` is saved on the device: the highest tier already
 * reported for each achievement, so a tier is celebrated once. A diner with no entry yet is
 * baselined silently (nothing celebrated for what they had before this shipped).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  detectAchievementUnlocks,
  type AchievementLevels,
  type AchievementUnlock,
} from "@/features/achievements/unlocks";
import type { AchievementRow } from "@/features/achievements/achievements";
import { trackAchievementUnlocked } from "@/lib/analytics/gamificationEvents";

import { hungryPersistStorage } from "./persistStorage";

export type Moment =
  | { kind: "stamp"; id: string; stampId: string }
  | { kind: "achievement"; id: string; unlock: AchievementUnlock };

interface MomentState {
  queue: Moment[];
  levelsByUser: Record<string, AchievementLevels>;

  /** Adds a moment unless one with the same id is already waiting. */
  enqueue: (moment: Moment) => void;
  /** Removes the moment on screen so the next one can show. */
  dismissCurrent: () => void;
  /**
   * Compares the diner's achievement tiers with what was reported. First time for this diner:
   * remembers the tiers and celebrates nothing. After that: queues one moment per new tier and
   * reports `achievement_unlocked`. Returns the unlocks queued.
   */
  reportAchievements: (userId: string, rows: readonly AchievementRow[]) => AchievementUnlock[];
  _reset: () => void;
}

export const useMomentStore = create<MomentState>()(
  persist(
    (set, get) => ({
      queue: [],
      levelsByUser: {},

      enqueue: (moment) => {
        if (get().queue.some((item) => item.id === moment.id)) return;
        set((state) => ({ queue: [...state.queue, moment] }));
      },

      dismissCurrent: () => set((state) => ({ queue: state.queue.slice(1) })),

      reportAchievements: (userId, rows) => {
        const known = get().levelsByUser[userId];
        const { unlocks, levels } = detectAchievementUnlocks(rows, known ?? {});
        const changed = unlocks.length > 0;
        if (!known || changed) {
          set((state) => ({ levelsByUser: { ...state.levelsByUser, [userId]: levels } }));
        }
        if (!known || !changed) return [];
        for (const unlock of unlocks) {
          trackAchievementUnlocked({
            achievementId: unlock.achievementId,
            level: unlock.level,
            totalLevels: unlock.totalLevels,
          });
          get().enqueue({
            kind: "achievement",
            id: `${unlock.achievementId}-${unlock.level}`,
            unlock,
          });
        }
        return unlocks;
      },

      _reset: () => set({ queue: [], levelsByUser: {} }),
    }),
    {
      name: "hungry-moments-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ levelsByUser: state.levelsByUser }),
    },
  ),
);
